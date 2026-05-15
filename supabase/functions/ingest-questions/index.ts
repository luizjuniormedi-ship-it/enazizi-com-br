
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient, logPipelineAlert } from "../_shared/pipeline-logger.ts";
import { aiFetch, parseAiJson } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { normalizeModel } from "../_shared/model-normalizer.ts";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";

// Utility to handle PDF (imported inside the function logic if possible or as safe ESM)
// We use esm.sh for pdfjs-serverless which is safer for Deno
import { getDocument } from "https://esm.sh/pdfjs-serverless";

// ─── CONSTANTS & PATTERNS (Side-effect free) ──────────────────────────────────
const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir)\b/i;
const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female)\b/i;

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-záàâãéèêíìóòôõúùûç0-9]/g, "").slice(0, 200);
}

function isValidQuestion(q: { statement?: string; options?: string[]; correct_index?: number }): boolean {
  if (!q.statement || !Array.isArray(q.options) || typeof q.correct_index !== "number") return false;
  if (q.options.length < 4) return false;
  if (q.statement.length < 50) return false;
  if (IMAGE_REF_PATTERN.test(q.statement)) return false;
  if (ENGLISH_PATTERN.test(q.statement)) return false;
  
  const validOpts = q.options.filter(o => String(o).trim().length > 0);
  if (validOpts.length < 4) return false;

  return true;
}

async function extractPdfTextFromBytes(data: Uint8Array): Promise<string> {
  console.log("[PDF_PARSE] Extracting text...");
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= document.numPages; i++) {
    const page = await document.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: any) => (item?.str || ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) pages.push(text);
  }

  return pages.join("\n\n");
}

function normalizePdfExamText(text: string): string {
  return text
    .replace(/Quest[\S]{0,3}o(?=\s+\d)/gi, "QUESTÃO")
    .replace(/Medway\s*-\s*ENARE\s*-\s*\d{4}\s*P[aá]ginas?\s*\d+\/\d+/gi, " ")
    .replace(/ENARE-\d{4}-Objetiva\s*\|\s*R1/gi, " ")
    .replace(/P[aá]ginas?\s*\d+\/\d+/gi, " ")
    .replace(/proibida\s+venda[^\n]{0,80}/gi, " ")
    .replace(/t\.me\/\S+/gi, " ")
    .replace(/Venda proibida[^\n]{0,120}/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuestionsFromPdfExamText(text: string, fallbackTopic: string): any[] {
  console.log("[REGEX_PARSE] Extracting questions from text...");
  const cleaned = normalizePdfExamText(text);
  const blocks = cleaned
    .split(/(?=QUEST[ÃA]O\s+\d+[\s\.:])/i)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions: any[] = [];

  for (const rawBlock of blocks) {
    let block = rawBlock.replace(/^QUEST[ÃA]O\s+\d+[\s\.:]*/i, "").trim();
    const markerRegex = /(?:^|[\s\n])([A-E])(?:[\.)\-]\s|\s+(?=[A-ZÀ-Úa-zà-ú0-9]))/g;
    const allMarkers = Array.from(block.matchAll(markerRegex)).map((match) => ({
      letter: match[1],
      rawIndex: match.index ?? 0,
      start: (match.index ?? 0) + match[0].length,
    }));

    const sequence = ["A", "B", "C", "D", "E"];
    const markers: any[] = [];
    let seqIdx = 0;
    for (const m of allMarkers) {
      if (m.letter === sequence[seqIdx]) {
        markers.push(m);
        seqIdx++;
        if (seqIdx >= 5) break;
      }
    }

    if (markers.length < 4) continue;

    const statement = block.slice(0, markers[0].rawIndex).trim();
    if (statement.length < 50) continue; 

    const options: string[] = [];
    for (let i = 0; i < markers.length && i < 5; i++) {
      const start = markers[i].start;
      const end = i + 1 < markers.length ? markers[i + 1].rawIndex : block.length;
      const option = block.slice(start, end).trim().replace(/^[\-–—:;\s]+/, "").replace(/[;\s]+$/, "").replace(/\s+/g, " ").trim();
      if (option) options.push(option);
    }

    if (options.length < 4) continue;

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

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

serve(async (req) => {
  console.log(`[BOOT] ingest-questions: ${req.method}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    
    // Auth Check
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
        if (!roleData) return new Response(JSON.stringify({ success: false, error: "Admin only" }), { status: 403, headers: corsHeaders });
      }
    }

    // Body Parse
    const body = await req.json().catch(() => ({}));
    const { mode, url, upload_id, banca, year, source_type = "unknown", permission_type = "unknown" } = body;

    if (!mode) {
      return new Response(JSON.stringify({ success: true, stage: "BOOT_OK_V3", function: "ingest-questions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[EXEC] Mode: ${mode}`);

    // Mode logic (simplified for initial restoration, focusing on stability)
    if (mode === "web_navigate") {
      // Scraper logic...
      return new Response(JSON.stringify({ success: true, stage: "NAVIGATED", message: "Web navigation not implemented in mini-core yet" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let fullText = "";
    let sourceName = "";
    let questions: any[] = [];

    if (mode === "upload" && upload_id) {
      const { data: upload, error: uploadErr } = await supabase.from("uploads").select("*").eq("id", upload_id).single();
      if (uploadErr || !upload) throw new Error("Upload not found");
      
      sourceName = `Upload: ${upload.filename}`;
      if (upload.storage_path) {
        const { data: fileData, error: downloadErr } = await supabase.storage.from("user-uploads").download(upload.storage_path);
        if (!downloadErr && fileData) {
          const isPdf = upload.filename.toLowerCase().endsWith(".pdf");
          if (isPdf) {
            const bytes = new Uint8Array(await fileData.arrayBuffer());
            fullText = await extractPdfTextFromBytes(bytes);
          } else {
            fullText = await fileData.text();
          }
        }
      }
      if (!fullText && upload.extracted_text) fullText = upload.extracted_text;
      questions = parseQuestionsFromPdfExamText(fullText, banca || "Geral");
    } else if (mode === "direct_text" && body.text) {
      fullText = body.text;
      sourceName = "Direct Text Import";
      questions = parseQuestionsFromPdfExamText(fullText, banca || "Geral");
    }

    // If regex fails to find enough questions, try AI extraction
    if (questions.length < 5 && fullText.length > 100) {
      console.log("[AI_REQUEST] Attempting AI extraction...");
      const aiResp = await aiFetch({
        model: ALLOWED_MODELS.generation,
        messages: [
          { role: "system", content: "Extraia questões médicas estruturadas em JSON." },
          { role: "user", content: `Texto:\n${fullText.slice(0, 15000)}\n\nExtraia no formato: {"questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_index": 0}]}` }
        ],
        response_format: { type: "json_object" }
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const parsed = parseAiJson(aiData.choices?.[0]?.message?.content || "{}");
        if (Array.isArray(parsed.questions)) questions.push(...parsed.questions);
      }
    }

    // Insert Questions
    const validQuestions = questions.filter(isValidQuestion);
    console.log(`[DB_INSERT] Inserting ${validQuestions.length} questions...`);

    for (const q of validQuestions) {
      const { data: question, error: qErr } = await supabase.from("question_bank").insert({
        statement: sanitizeForPostgres(q.statement),
        topic: q.topic || banca || "Geral",
        subtopic: q.subtopic || "Geral",
        year: year || new Date().getFullYear(),
        banca: banca || "Geral",
        difficulty: "medium",
        is_real: true,
        source_url: url || "",
        created_by: userId
      }).select().single();

      if (question && !qErr) {
        const optionsData = q.options.map((opt: string, idx: number) => ({
          question_id: question.id,
          text: sanitizeForPostgres(opt),
          is_correct: idx === q.correct_index,
          order_index: idx
        }));
        await supabase.from("question_options").insert(optionsData);
      }
    }

    // Log the action
    await supabase.from("ingestion_log").insert({
      source_name: sourceName,
      source_url: url,
      questions_found: validQuestions.length,
      status: "completed",
      created_by: userId
    });

    return new Response(JSON.stringify({
      success: true,
      questions_found: questions.length,
      questions_inserted: validQuestions.length,
      stage: "COMPLETED"
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[CRITICAL_ERR]", err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
      stage: "BOOT_CATCH"
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
