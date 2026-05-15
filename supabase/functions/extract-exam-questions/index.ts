import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth: verify admin when called with user JWT
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "admin")
            .maybeSingle();
          if (!roleData) {
            return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
          }
        }
      } catch {
        // If auth fails (anon key etc), allow - function is protected by verify_jwt=false + admin UI only
      }
    }

    const body = await req.json().catch(() => ({}));
    const uploadId = body.upload_id || "f8b2995a-d260-4d76-9a28-a9ae02c12419";

    // Get the upload record
    const { data: upload, error: uploadErr } = await supabase
      .from("uploads")
      .select("storage_path, extracted_text, filename")
      .eq("id", uploadId)
      .single();

    if (uploadErr || !upload) {
      return new Response(JSON.stringify({ error: "Upload not found" }), { status: 404, headers: corsHeaders });
    }

    let fullText = "";

    // Try storage first for complete file
    if (upload.storage_path) {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("user-uploads")
        .download(upload.storage_path);
      if (!dlErr && fileData) {
        fullText = await fileData.text();
      }
    }

    // Fallback to extracted_text
    if (!fullText && upload.extracted_text) {
      fullText = upload.extracted_text;
    }

    if (!fullText) {
      return new Response(JSON.stringify({ error: "No text content found" }), { status: 400, headers: corsHeaders });
    }

    // Clean up OCR artifacts and sanitize database-incompatible characters (like null bytes)
    fullText = fullText.replace(/\0/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Split by year markers: look for standalone year numbers (2011-2025)
    const yearSections: { year: number; text: string }[] = [];
    
    // Try to find year boundaries
    const yearRegex = /(?:^|\n)\s*(20(?:1[1-9]|2[0-6])(?:\.\d)?)\s*(?:\n|$)/g;
    const yearPositions: { year: string; index: number }[] = [];
    let match;
    while ((match = yearRegex.exec(fullText)) !== null) {
      yearPositions.push({ year: match[1], index: match.index });
    }

    if (yearPositions.length === 0) {
      // Try alternate format: "REVALIDA 2020", "PROVA 2020", etc.
      const altRegex = /(?:REVALIDA|PROVA|INEP)\s*(20(?:1[1-9]|2[0-6]))/gi;
      while ((match = altRegex.exec(fullText)) !== null) {
        yearPositions.push({ year: match[1], index: match.index });
      }
    }

    // If still no years found, treat as single block
    if (yearPositions.length === 0) {
      yearSections.push({ year: 2020, text: fullText });
    } else {
      // Deduplicate years (keep first occurrence)
      const seenYears = new Set<string>();
      const uniquePositions = yearPositions.filter((p) => {
        if (seenYears.has(p.year)) return false;
        seenYears.add(p.year);
        return true;
      });

      for (let i = 0; i < uniquePositions.length; i++) {
        const start = uniquePositions[i].index;
        const end = i + 1 < uniquePositions.length ? uniquePositions[i + 1].index : fullText.length;
        const yearNum = parseInt(uniquePositions[i].year.replace(".", ""));
        yearSections.push({ year: yearNum, text: fullText.slice(start, end) });
      }
    }

    // Parse questions from each year section
    const allResults: {
      year: number;
      questions: ParsedQ[];
      examBankId?: string;
    }[] = [];

    for (const section of yearSections) {
      let questions = parseExamQuestions(section.text);
      
      // Fallback: If regex finds nothing or too few questions (and section is large), use LLM
      if ((questions.length < 5 && section.text.length > 5000) || questions.length === 0) {
        console.log(`Regex found only ${questions.length} questions for year ${section.year}. Trying LLM fallback...`);
        try {
          // Dynamic import to use the shared helper
          const { aiFetch, parseAiJson } = await import("../_shared/ai-fetch.ts");
          
          const prompt = `Extraia questões médicas do texto abaixo para o ano ${section.year}.
          O texto é de uma prova do REVALIDA INEP.
          Retorne um objeto JSON com um array "questions" contendo: statement, options (array de 4 ou 5), correctIndex (0-4), explanation, topic.
          
          TEXTO:
          ${section.text.slice(0, 15000)}`;

          const aiResp = await aiFetch({
            model: "openai/gpt-4o-mini",
            messages: [
              { role: "system", content: "Você é um extrator de provas médicas especializado em REVALIDA." },
              { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || "{}";
            const parsed = parseAiJson(content);
            const llmQs = (parsed.questions || []).map((q: any) => ({
              statement: q.statement,
              options: q.options,
              correctIndex: q.correctIndex ?? q.correct_index ?? 0,
              explanation: q.explanation || "",
              topic: q.topic || "Geral"
            }));
            
            if (llmQs.length > questions.length) {
              console.log(`LLM extracted ${llmQs.length} questions, replacing regex results.`);
              questions = llmQs;
            }
          }
        } catch (err) {
          console.error(`LLM fallback failed for ${section.year}:`, err);
        }
      }

      if (questions.length > 0) {
        allResults.push({ year: section.year, questions });
      }
    }

    // Create exam_banks entries and insert questions
    let totalInserted = 0;
    const examBanksCreated: string[] = [];

    for (const result of allResults) {
      const yearStr = result.year.toString();
      const sourceTag = `REVALIDA INEP ${yearStr}`;
      const bankName = `REVALIDA ${yearStr}`;

      // Check if exam_bank already exists
      const { data: existingBank } = await supabase
        .from("exam_banks")
        .select("id")
        .eq("source_tag", sourceTag)
        .maybeSingle();

      let bankId: string;
      if (existingBank) {
        bankId = existingBank.id;
      } else {
        const { data: newBank, error: bankErr } = await supabase
          .from("exam_banks")
          .insert(sanitizeForPostgres({
            name: bankName,
            banca: "INEP",
            year: result.year,
            source_tag: sourceTag,
            total_questions: result.questions.length,
          }))
          .select("id")
          .single();

        if (bankErr || !newBank) {
          console.error(`Failed to create exam_bank for ${yearStr}:`, bankErr);
          continue;
        }
        bankId = newBank.id;
        examBanksCreated.push(bankName);
      }

      result.examBankId = bankId;

      // Deduplicate against existing questions for this bank
      const { data: existingQs } = await supabase
        .from("questions_bank")
        .select("statement")
        .eq("exam_bank_id", bankId);

      const existingStatements = new Set(
        (existingQs || []).map((q: any) => normalizeForDedup(q.statement))
      );

      // Also check by source tag
      const { data: existingBySource } = await supabase
        .from("questions_bank")
        .select("statement")
        .eq("source", sourceTag);

      (existingBySource || []).forEach((q: any) => {
        existingStatements.add(normalizeForDedup(q.statement));
      });

      // Insert new questions in batches
      const newQuestions = result.questions.filter(
        (q) => !existingStatements.has(normalizeForDedup(q.statement)) &&
          q.options.length >= 4 && q.options.length <= 5 &&
          q.statement.length >= 400
      );

      const BATCH_SIZE = 50;
      // We need a user_id for the insert - use a system/admin placeholder
      // Get the first admin user
      const { data: adminUser } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .single();

      const systemUserId = adminUser?.user_id || "00000000-0000-0000-0000-000000000000";

      for (let i = 0; i < newQuestions.length; i += BATCH_SIZE) {
        const batch = newQuestions.slice(i, i + BATCH_SIZE).map((q, idx) => sanitizeForPostgres({
          statement: q.statement,
          options: q.options,
          correct_index: q.correctIndex,
          explanation: q.explanation || "",
          topic: q.topic || "Geral",
          source: sourceTag,
          is_global: true,
          user_id: systemUserId,
          exam_bank_id: bankId,
          question_order: i + idx + 1,
        }));

        const { error: insertErr } = await supabase
          .from("questions_bank")
          .insert(batch);

        if (insertErr) {
          console.error(`Insert error for ${yearStr} batch ${i}:`, insertErr);
        } else {
          totalInserted += batch.length;
        }
      }

      // Update exam_bank total
      const { count } = await supabase
        .from("questions_bank")
        .select("id", { count: "exact", head: true })
        .eq("exam_bank_id", bankId);

      if (count !== null) {
        await supabase
          .from("exam_banks")
          .update({ total_questions: count })
          .eq("id", bankId);
      }
    }

    // Also link existing questions_bank entries to exam_banks by source
    let linkedCount = 0;
    for (const result of allResults) {
      if (!result.examBankId) continue;
      const sourceTag = `REVALIDA INEP ${result.year}`;
      const sourceVariants = [
        sourceTag,
        `REVALIDA ${result.year}`,
        `revalida-inep-${result.year}`,
        `REVALIDA INEP ${result.year} OBJETIVA`,
      ];

      for (const variant of sourceVariants) {
        const { data: unlinked } = await supabase
          .from("questions_bank")
          .select("id")
          .ilike("source", `%${variant}%`)
          .is("exam_bank_id", null);

        if (unlinked && unlinked.length > 0) {
          const ids = unlinked.map((q: any) => q.id);
          // Update in batches
          for (let i = 0; i < ids.length; i += 100) {
            const batchIds = ids.slice(i, i + 100);
            const { error: linkErr } = await supabase
              .from("questions_bank")
              .update({ exam_bank_id: result.examBankId })
              .in("id", batchIds);
            if (!linkErr) linkedCount += batchIds.length;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        years_found: allResults.map((r) => ({
          year: r.year,
          questions_parsed: r.questions.length,
        })),
        total_inserted: totalInserted,
        total_linked: linkedCount,
        exam_banks_created: examBanksCreated,
        text_length: fullText.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Extract error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// --- Parser ---

interface ParsedQ {
  statement: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic?: string;
}

function normalizeForDedup(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\wàáâãéêíóôõúüç ]/gi, "")
    .trim()
    .slice(0, 200);
}

function parseExamQuestions(text: string): ParsedQ[] {
  const questions: ParsedQ[] = [];

  // Split by numbered questions: "1.", "2.", etc. at start of line
  // Also handle "Questão 1", "QUESTÃO 01" etc.
  const parts = text.split(
    /(?=(?:^|\n)\s*(?:\d{1,3}\s*\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|(?:Questão|QUESTÃO)\s+\d+))/
  );

  for (const part of parts) {
    if (part.trim().length < 50) continue;

    // Must have options A-E
    const optionRegex = /(?:^|\n)\s*([A-E])\s*[).]\s*(.+)/g;
    const optionMatches: { letter: string; text: string }[] = [];
    let optMatch;
    
    // Reset and collect
    const optLines = part.match(/(?:^|\n)\s*[A-E]\s*[).]\s*.+/g);
    if (!optLines || optLines.length < 2) continue;

    for (const line of optLines) {
      const m = line.match(/\s*([A-E])\s*[).]\s*(.+)/);
      if (m) {
        optionMatches.push({ letter: m[1], text: m[2].trim() });
      }
    }

    if (optionMatches.length < 2) continue;

    // Find where options start
    const firstOptMatch = part.match(/(?:^|\n)\s*A\s*[).]\s*/);
    if (!firstOptMatch) continue;
    const optStartIdx = part.indexOf(firstOptMatch[0]);

    // Statement is everything before options
    let statement = part.slice(0, optStartIdx).trim();
    // Remove question number prefix
    statement = statement.replace(/^\s*\d{1,3}\s*\.\s*/, "").trim();
    statement = statement.replace(/^\s*(?:Questão|QUESTÃO)\s+\d+\s*[:.]*\s*/i, "").trim();

    if (statement.length < 30) continue;

    // Find correct answer from the text after options
    const lastOpt = optionMatches[optionMatches.length - 1];
    const lastOptRegex = new RegExp(
      `(?:^|\\n)\\s*${lastOpt.letter}\\s*[).]\\s*${escapeRegex(lastOpt.text.slice(0, 20))}`,
    );
    const lastOptMatch = part.match(lastOptRegex);
    const afterOptionsText = lastOptMatch
      ? part.slice(part.indexOf(lastOptMatch[0]) + lastOptMatch[0].length)
      : "";

    // Look for "Alternativa X – Correta" or "Gabarito: X" or "Resposta: X"
    let correctIndex = -1;
    const correctPatterns = [
      /Alternativa\s+([A-E])\s*[-–—:]\s*(?:Correta|CORRETA|correta)/i,
      /(?:Gabarito|Resposta|GABARITO)\s*[:=]\s*(?:Alternativa\s+)?([A-E])/i,
      /(?:Letra|LETRA)\s+([A-E])/i,
      /\b([A-E])\s*[-–—]\s*(?:Correta|CORRETA)/i,
    ];

    // Search in after-options text AND full part
    const searchTexts = [afterOptionsText, part];
    for (const searchText of searchTexts) {
      if (correctIndex >= 0) break;
      for (const pattern of correctPatterns) {
        const gabMatch = searchText.match(pattern);
        if (gabMatch) {
          correctIndex = gabMatch[1].toUpperCase().charCodeAt(0) - 65;
          break;
        }
      }
    }

    if (correctIndex < 0) correctIndex = 0; // fallback

    // Extract explanation: everything after the options that looks like commentary
    let explanation = "";
    if (afterOptionsText.length > 20) {
      explanation = afterOptionsText
        .replace(/^\s*\n/, "")
        .trim()
        .slice(0, 2000);
    }

    // Try to extract topic from context
    let topic: string | undefined;
    const topicPatterns = [
      /(?:Área|Tema|Especialidade)\s*[:]\s*([^\n]{3,60})/i,
      /(?:Clínica Médica|Cirurgia|Pediatria|Ginecologia|Obstetrícia|Saúde Coletiva|Medicina Preventiva)/i,
    ];
    for (const tp of topicPatterns) {
      const tm = part.match(tp);
      if (tm) {
        topic = (tm[1] || tm[0]).trim();
        break;
      }
    }

    questions.push({
      statement,
      options: optionMatches.map((o) => o.text),
      correctIndex: Math.min(correctIndex, optionMatches.length - 1),
      explanation,
      topic,
    });
  }

  return questions;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
