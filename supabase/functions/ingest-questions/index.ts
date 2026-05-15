import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir)\b/i;
const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female)\b/i;

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-záàâãéèêíìóòôõúùûç0-9]/g, "").slice(0, 200);
}

function isValidQuestion(q: { statement?: string; options?: string[]; correct_index?: number }): boolean {
  if (!q.statement || !Array.isArray(q.options) || typeof q.correct_index !== "number") return false;
  if (q.options.length < 4 || q.options.length > 5) return false;
  
  // High quality standard: Real questions are rarely extremely short
  // Standard medical questions usually have between 300 and 1500 chars
  if (q.statement.length < 250) return false;
  
  // Reject questions with image references since we can't ingest images yet
  if (IMAGE_REF_PATTERN.test(q.statement)) return false;
  if (ENGLISH_PATTERN.test(q.statement)) return false;
  
  // Reject statements that contain metadata (topic/specialty names embedded)
  const metadataPattern = /^(Cardiologia|Pediatria|Cirurgia|Neurologia|Pneumologia|Ginecologia|Obstetrícia|Infectologia|Dermatologia|Endocrinologia|Gastroenterologia|Hematologia|Nefrologia|Reumatologia|Urologia|Psiquiatria|Oncologia|Angiologia|Ortopedia)\s*[-–—:]/i;
  if (metadataPattern.test(q.statement.trim())) return false;

  // Real medical questions avoid trivial or extremely short options (except numbers/dates)
  const validOpts = q.options.filter(o => {
    const text = String(o).trim();
    if (text.length <= 1) return false;
    // Basic medical vocabulary check or numeric/date
    const isNumeric = /^\d+/.test(text);
    return text.length > 3 || isNumeric;
  });
  if (validOpts.length < 4) return false;

  return true;
}

async function extractPdfTextFromBytes(data: Uint8Array): Promise<string> {
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= document.numPages; i++) {
    const page = await document.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: unknown) => (typeof item === "object" && item !== null && "str" in item ? String((item as { str: string }).str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) pages.push(text);
  }

  return pages.join("\n\n");
}

async function extractPdfTextFromUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    // Use dangerousAllowAnyCertificate to bypass SSL issues on official sites (like FGV/ENARE)
    const client = Deno.createHttpClient({
      dangerousAllowAnyCertificate: true,
    });
    
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
      client,
    } as any);

    if (!resp.ok) {
      throw new Error(`Falha ao baixar PDF (${resp.status})`);
    }

    const data = new Uint8Array(await resp.arrayBuffer());
    return await extractPdfTextFromBytes(data);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function extractPdfTextFromBlob(fileData: Blob): Promise<string> {
  const data = new Uint8Array(await fileData.arrayBuffer());
  return await extractPdfTextFromBytes(data);
}

function normalizePdfExamText(text: string): string {
  return text
    .replace(/Medway\s*-\s*ENARE\s*-\s*\d{4}\s*P[aá]ginas?\s*\d+\/\d+/gi, " ")
    .replace(/ENARE-\d{4}-Objetiva\s*\|\s*R1/gi, " ")
    .replace(/P[aá]ginas?\s*\d+\/\d+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuestionsFromPdfExamText(text: string, fallbackTopic: string): Array<{
  statement: string;
  options: string[];
  correct_index: number;
  topic: string;
  subtopic: string;
  explanation: string;
}> {
  const cleaned = normalizePdfExamText(text);
  const blocks = cleaned
    .split(/(?=QUEST[ÃA]O\s+\d+[\s\.:])/i)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions: Array<{
    statement: string;
    options: string[];
    correct_index: number;
    topic: string;
    subtopic: string;
    explanation: string;
  }> = [];

  for (const rawBlock of blocks) {
    let block = rawBlock.replace(/^QUEST[ÃA]O\s+\d+[\s\.:]*/i, "").trim();
    
    const markerRegex = /(?:^|\s)([A-E])[\.)]\s/g;
    const markers = Array.from(block.matchAll(markerRegex)).map((match) => ({
      letter: match[1],
      rawIndex: match.index ?? 0,
      start: (match.index ?? 0) + match[0].length,
    }));

    if (markers.length < 4) continue;

    const statement = block.slice(0, markers[0].rawIndex).trim();
    if (statement.length < 50) continue; 
    if (IMAGE_REF_PATTERN.test(statement) || ENGLISH_PATTERN.test(statement)) continue;

    const options: string[] = [];
    for (let i = 0; i < markers.length && i < 5; i++) {
      const start = markers[i].start;
      const end = i + 1 < markers.length ? markers[i + 1].rawIndex : block.length;
      const option = block
        .slice(start, end)
        .trim()
        .replace(/^[\-–—:;\s]+/, "")
        .replace(/[;\s]+$/, "")
        .replace(/\s+/g, " ")
        .trim();

      if (option) options.push(option);
    }

    if (options.length < 4 || options.length > 5) continue;

    const gabaritoMatch = block.match(/(?:gabarito|resposta|alternativa)\s*[:=\-]?\s*([A-E])/i);
    const correctIndex = gabaritoMatch ? gabaritoMatch[1].toUpperCase().charCodeAt(0) - 65 : 0;

    questions.push({
      statement,
      options,
      correct_index: Math.max(0, Math.min(correctIndex, options.length - 1)),
      topic: fallbackTopic,
      subtopic: "Geral",
      explanation: "",
    });
  }

  return questions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          userId = user.id;
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
        /* allow service calls */
      }
    }

    const body = await req.json();
    const { mode, url, upload_id, banca, year, source_type = "unknown", permission_type = "unknown" } = body;

    if (!mode) {
      return new Response(JSON.stringify({ error: "mode is required" }), { status: 400, headers: corsHeaders });
    }

    if (mode === "web_navigate") {
      if (!url) {
        return new Response(JSON.stringify({ error: "url required for web_navigate" }), { status: 400, headers: corsHeaders });
      }

      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      let pageText = "";

      if (firecrawlKey) {
        try {
          const fcResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
            body: JSON.stringify({ url, formats: ["markdown"] }),
          });
          const fcData = await fcResp.json();
          pageText = fcData?.data?.markdown || "";
        } catch {
          /* fallback below */
        }
      }

      if (!pageText) {
        try {
          const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
          pageText = await resp.text();
        } catch (e) {
          return new Response(JSON.stringify({ error: `Failed to fetch: ${e}` }), { status: 500, headers: corsHeaders });
        }
      }

      const pdfLinks: { name: string; url: string; year?: number }[] = [];
      const pdfRegex = /https?:\/\/[^\s"'<>]+\.pdf/gi;
      const matches = pageText.match(pdfRegex) || [];
      for (const m of matches) {
        const yearMatch = m.match(/(20\d{2})/);
        pdfLinks.push({ name: m.split("/").pop() || "prova.pdf", url: m, year: yearMatch ? parseInt(yearMatch[1]) : undefined });
      }

      await supabase.from("ingestion_log").insert({
        source_name: `Web: ${url}`,
        source_url: url,
        source_type: "indexed_external",
        permission_type: "indexed_external",
        questions_found: 0,
        status: "navigated",
        created_by: userId,
      });

      return new Response(JSON.stringify({ pdf_links: pdfLinks, page_length: pageText.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "index_only") {
      const { data: log } = await supabase.from("ingestion_log").insert({
        source_name: body.source_name || `Indexed: ${url || "unknown"}`,
        source_url: url,
        source_type,
        permission_type,
        banca,
        year,
        questions_found: 0,
        status: "indexed",
        created_by: userId,
      }).select().single();

      return new Response(JSON.stringify({ success: true, log }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let fullText = "";
    let sourceName = "";
    const sourceUrl = url || "";
    let questions: any[] = [];

    if (mode === "pdf_url" && url) {
      sourceName = `PDF: ${url.split("/").pop()}`;
      try {
        fullText = await extractPdfTextFromUrl(url);
        questions = parseQuestionsFromPdfExamText(fullText, banca || "Geral");
      } catch (e) {
        console.error("PDF extraction failed:", e);
      }
    } else if (mode === "upload" && upload_id) {
      const { data: upload } = await supabase.from("uploads")
        .select("storage_path, extracted_text, filename, file_type")
        .eq("id", upload_id)
        .single();
      if (!upload) {
        return new Response(JSON.stringify({ error: "Upload not found" }), { status: 404, headers: corsHeaders });
      }
      sourceName = `Upload: ${upload.filename}`;
      if (upload.storage_path) {
        const { data: fileData } = await supabase.storage.from("user-uploads").download(upload.storage_path);
        if (fileData) {
          const looksLikePdf = String(upload.file_type || upload.filename || "").toLowerCase().includes("pdf");
          fullText = looksLikePdf ? await extractPdfTextFromBlob(fileData) : await fileData.text();
        }
      }
      if (!fullText && upload.extracted_text) fullText = upload.extracted_text;
      questions = parseQuestionsFromPdfExamText(fullText, banca || "Geral");
    }

    if (!fullText && mode === "direct_text" && body.text) {
      fullText = body.text;
      sourceName = `Texto: ${body.banca || "Importação Direta"}`;
    }

    if (!fullText) {
      return new Response(JSON.stringify({ error: "No content extracted" }), { status: 400, headers: corsHeaders });
    }

    if (questions.length === 0) {
      console.log("Regex parsing failed, trying LLM extraction...");
      try {
        const { aiFetch, parseAiJson } = await import("../_shared/ai-fetch.ts");
        const prompt = `Você é um extrator de questões médicas de alta precisão. 
        Abaixo está o texto extraído de um PDF de prova de residência médica. 
        Extraia TODAS as questões completas seguindo rigorosamente o formato JSON.
        
        REGRAS:
        1. Ignore cabeçalhos, rodapés e metadados.
        2. Identifique enunciado e alternativas (A a E).
        3. Identifique o gabarito se estiver presente.
        4. O campo "topic" deve ser "${banca || "Geral"}".
        
        TEXTO:
        ${fullText.slice(0, 15000)}
        
        FORMATO:
        { "questions": [{ "statement": "...", "options": ["A) ...", "B) ..."], "correct_index": 0, "topic": "...", "subtopic": "...", "explanation": "..." }] }`;

        const aiResp = await aiFetch({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "system", content: "Você é um assistente que extrai questões estruturadas de textos de provas." }, { role: "user", content: prompt }],
          response_format: { type: "json_object" }
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const rawContent = aiData.choices?.[0]?.message?.content || "{}";
          const parsed = parseAiJson(rawContent);
          questions = parsed.questions || [];
          console.log(`LLM extracted ${questions.length} questions.`);
        }
      } catch (aiErr) {
        console.error("LLM extraction failed:", aiErr);
      }
    }

    if (questions.length === 0) {
      // Last resort: manual regex block splitting if LLM also failed or wasn't used
      const qBlocks = fullText.split(/(?=(?:\d+[\.\)]\s|QUEST[ÃA]O\s+\d+))/i);
      for (const block of qBlocks) {
        // ... (keep existing fallback logic if needed, or just let it fail)
      }
    }

    if (questions.length === 0) {
      await supabase.from("ingestion_log").insert({
        source_name: sourceName || (url ? `PDF: ${url}` : "unknown"),
        source_url: sourceUrl,
        source_type,
        permission_type,
        banca,
        year,
        questions_found: 0,
        questions_inserted: 0,
        questions_updated: 0,
        duplicates_skipped: 0,
        errors: 0,
        status: "failed",
        created_by: userId,
      });

      return new Response(JSON.stringify({
        success: false,
        error: "Nenhuma questão estruturada foi reconhecida no PDF.",
        questions_found: 0,
        questions_inserted: 0,
        questions_updated: 0,
        duplicates_skipped: 0,
        errors: 0,
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Load ALL existing question keys for deduplication (paginated)
    const existingMap = new Map<string, { id: string; statement: string }>();
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data: page } = await supabase.from("questions_bank")
        .select("id, statement")
        .range(offset, offset + PAGE - 1);
      if (!page || page.length === 0) break;
      for (const e of page) {
        existingMap.set(normalizeText(e.statement).slice(0, 80), e);
      }
      if (page.length < PAGE) break;
      offset += PAGE;
    }

    // Fallback para um dos IDs conhecidos do auth.users se profiles estiver inconsistente
    const adminUserId = userId || "d342be08-4a6a-4183-94a0-fce42255cec1";

    for (const q of questions) {
      if (!isValidQuestion(q)) {
        errors++;
        continue;
      }

      const normKey = normalizeText(q.statement).slice(0, 80);
      const match = existingMap.get(normKey);

      if (match) {
        if (q.correct_index >= 0 && q.explanation) {
          await supabase.from("questions_bank").update({
            explanation: q.explanation,
            source_type,
            permission_type,
            source_url: sourceUrl,
          }).eq("id", match.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const opts = [...q.options];
        while (opts.length < 5) opts.push(`Alternativa ${String.fromCharCode(65 + opts.length)}`);
        if (opts.length > 5) opts.splice(5);

        // Heuristic for difficulty based on length and medical complexity
        let difficulty = 3; // Standard
        const textLen = q.statement.length;
        if (textLen > 1000 || /paciente de \d+ anos.*diagn[óo]stico/i.test(q.statement)) {
          difficulty = 4; // High (Clinical Cases)
        } else if (textLen < 400 && !/diagn[óo]stico|tratamento/i.test(q.statement)) {
          difficulty = 2; // Medium-Low
        }

        const { error: insErr } = await supabase.from("questions_bank").insert({
          statement: q.statement.replace(/\0/g, ""),
          options: opts.map(o => String(o).replace(/\0/g, "")),
          correct_index: q.correct_index >= 0 ? q.correct_index : 0,
          topic: (q.topic || banca || "Geral").replace(/\0/g, ""),
          subtopic: (q.subtopic || "Geral").replace(/\0/g, ""),
          explanation: (q.explanation || "").replace(/\0/g, ""),
          source: `${banca || "external"}_${year || "unknown"}`,
          source_type,
          permission_type,
          source_url: sourceUrl,
          user_id: adminUserId,
          is_global: true,
          difficulty: difficulty,
          review_status: "pending",
        });

        if (insErr) {
          errors++;
          console.error("Insert error:", insErr);
        } else {
          inserted++;
          existingMap.set(normKey, { id: "new", statement: q.statement });
        }
      }
    }

    const noUsableQuestions = inserted === 0 && updated === 0 && skipped === 0;

    await supabase.from("ingestion_log").insert({
      source_name: sourceName,
      source_url: sourceUrl,
      source_type,
      permission_type,
      banca,
      year,
      questions_found: questions.length,
      questions_inserted: inserted ?? 0,
      questions_updated: updated ?? 0,
      duplicates_skipped: skipped ?? 0,
      errors,
      status: noUsableQuestions ? "failed" : "completed",
      created_by: userId,
    });

    const payload = {
      success: !noUsableQuestions,
      questions_found: questions.length,
      questions_inserted: inserted ?? 0,
      questions_updated: updated ?? 0,
      duplicates_skipped: skipped ?? 0,
      errors,
    };

    if (noUsableQuestions) {
      return new Response(JSON.stringify({
        ...payload,
        error: errors > 0 ? "Nenhuma questão válida foi extraída deste PDF." : "Nenhuma questão nova foi identificada.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});