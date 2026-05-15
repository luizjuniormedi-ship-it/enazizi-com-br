import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

console.log("[BOOT] ingest-questions function starting...");

const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir)\b/i;
const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female)\b/i;

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-záàâãéèêíìóòôõúùûç0-9]/g, "").slice(0, 200);
}

function isValidQuestion(q: { statement?: string; options?: string[]; correct_index?: number }): boolean {
  if (!q.statement || !Array.isArray(q.options) || typeof q.correct_index !== "number") return false;
  // Constraint check: MUST HAVE AT LEAST 4 OPTIONS
  if (q.options.length < 4) return false;
  
  if (q.statement.length < 50) return false; // Lowered from 250 for testing
  
  if (IMAGE_REF_PATTERN.test(q.statement)) return false;
  if (ENGLISH_PATTERN.test(q.statement)) return false;
  
  const validOpts = q.options.filter(o => {
    const text = String(o).trim();
    return text.length > 0;
  });
  if (validOpts.length < 4) return false;

  return true;
}

async function extractPdfTextFromBytes(data: Uint8Array): Promise<string> {
  console.log("[PDF_PARSE] Extracting text from bytes...");
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
  console.log(`[UPLOAD_FETCH] Fetching PDF from URL: ${url}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    // Attempt to bypass certificate issues
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
  console.log("[OCR/EXTRACT] Extracting text from Blob...");
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
  console.log("[JSON_PARSE] Regex parsing questions from text...");
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

Deno.serve(async (req) => {
  console.log(`[BOOT] Received ${req.method} request to ingest-questions`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 4. VALIDAR ENV VARS
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceKey) {
      console.error("[BOOT] Missing critical environment variables");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Server configuration error: missing env vars",
        step: "BOOT"
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // [AUTH]
    console.log("[AUTH] Checking authorization...");
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
            console.warn(`[AUTH] Non-admin user attempted access: ${user.id}`);
            return new Response(JSON.stringify({ success: false, error: "Admin only" }), { status: 403, headers: corsHeaders });
          }
        }
      } catch (err) {
        console.error("[AUTH] Auth check failed:", err);
      }
    }

    // [BODY_PARSE]
    console.log("[BODY_PARSE] Parsing request body...");
    let body;
    try {
      body = await req.json();
    } catch (err) {
      console.error("[BODY_PARSE] Invalid JSON body:", err);
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON body", step: "BODY_PARSE" }), { status: 400, headers: corsHeaders });
    }

    const { mode, url, upload_id, banca, year, source_type = "unknown", permission_type = "unknown" } = body;

    if (!mode) {
      return new Response(JSON.stringify({ success: false, error: "mode is required", step: "BODY_PARSE" }), { status: 400, headers: corsHeaders });
    }

    console.log(`[MODE] Executing mode: ${mode}`);

    if (mode === "web_navigate") {
      if (!url) {
        return new Response(JSON.stringify({ success: false, error: "url required for web_navigate" }), { status: 400, headers: corsHeaders });
      }

      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      let pageText = "";

      if (firecrawlKey) {
        console.log("[UPLOAD_FETCH] Using Firecrawl to scrape...");
        try {
          const fcResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
            body: JSON.stringify({ url, formats: ["markdown"] }),
          });
          const fcData = await fcResp.json();
          pageText = fcData?.data?.markdown || "";
        } catch (err) {
          console.error("[UPLOAD_FETCH] Firecrawl failed:", err);
        }
      }

      if (!pageText) {
        console.log("[UPLOAD_FETCH] Falling back to direct fetch...");
        try {
          const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
          pageText = await resp.text();
        } catch (e) {
          console.error("[UPLOAD_FETCH] Direct fetch failed:", e);
          return new Response(JSON.stringify({ success: false, error: `Failed to fetch: ${e}`, step: "UPLOAD_FETCH" }), { status: 500, headers: corsHeaders });
        }
      }

      const pdfLinks: { name: string; url: string; year?: number }[] = [];
      const pdfRegex = /https?:\/\/[^\s"'<>]+\.pdf/gi;
      const matches = pageText.match(pdfRegex) || [];
      for (const m of matches) {
        const yearMatch = m.match(/(20\d{2})/);
        pdfLinks.push({ name: m.split("/").pop() || "prova.pdf", url: m, year: yearMatch ? parseInt(yearMatch[1]) : undefined });
      }

      console.log(`[UPLOAD_FETCH] Found ${pdfLinks.length} PDF links.`);

      await supabase.from("ingestion_log").insert({
        source_name: `Web: ${url}`,
        source_url: url,
        source_type: "indexed_external",
        permission_type: "indexed_external",
        questions_found: 0,
        status: "navigated",
        created_by: userId,
      });

      return new Response(JSON.stringify({ success: true, pdf_links: pdfLinks, page_length: pageText.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "index_only") {
      console.log("[DB_INSERT] Indexing source only...");
      const { data: log, error: logErr } = await supabase.from("ingestion_log").insert({
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

      if (logErr) {
        console.error("[DB_INSERT] Failed to insert ingestion log:", logErr);
      }

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
        console.error("[OCR] PDF extraction from URL failed:", e);
      }
    } else if (mode === "upload" && upload_id) {
      console.log(`[UPLOAD_FETCH] Fetching upload metadata for ID: ${upload_id}`);
      const { data: upload, error: uploadErr } = await supabase.from("uploads")
        .select("storage_path, extracted_text, filename, file_type")
        .eq("id", upload_id)
        .single();
        
      if (uploadErr || !upload) {
        console.error("[UPLOAD_FETCH] Upload not found:", uploadErr);
        return new Response(JSON.stringify({ success: false, error: "Upload not found", step: "UPLOAD_FETCH" }), { status: 404, headers: corsHeaders });
      }
      
      sourceName = `Upload: ${upload.filename}`;
      if (upload.storage_path) {
        console.log(`[UPLOAD_FETCH] Downloading file from storage: ${upload.storage_path}`);
        const { data: fileData, error: downloadErr } = await supabase.storage.from("user-uploads").download(upload.storage_path);
        if (downloadErr) {
          console.error("[UPLOAD_FETCH] Failed to download file:", downloadErr);
        } else if (fileData) {
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
      console.error("[BODY_PARSE] No content extracted from any source.");
      return new Response(JSON.stringify({ success: false, error: "No content extracted", step: "BODY_PARSE" }), { status: 400, headers: corsHeaders });
    }

    // [AI_REQUEST]
    if (questions.length === 0) {
      console.log("[AI_REQUEST] Regex parsing failed or returned 0, trying LLM extraction...");
      try {
        const { aiFetch, parseAiJson } = await import("../_shared/ai-fetch.ts");
        const { AI_MODELS } = await import("../_shared/ai-models.ts");
        const { logPipelineAlert } = await import("../_shared/pipeline-logger.ts");
        
        const prompt = `Você é um extrator de questões médicas de alta precisão. 
        Abaixo está o texto extraído de um PDF de prova de residência médica. 
        Extraia TODAS as questões completas seguindo rigorosamente o formato JSON.
        
        REGRAS:
        1. Ignore cabeçalhos, rodapés e metadados.
        2. Identifique enunciado e alternativas (A a E). O banco de dados aceita 4 ou 5 alternativas.
        3. Se houver 5 alternativas, mantenha todas. Se houver 4, mantenha as 4.
        4. Identifique o gabarito se estiver presente.
        5. O campo "topic" deve ser "${banca || "Geral"}".
        
        TEXTO:
        ${fullText.slice(0, 15000)}
        
        FORMATO:
        { "questions": [{ "statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "correct_index": 0, "topic": "...", "subtopic": "...", "explanation": "..." }] }`;

        const aiResp = await aiFetch({
          model: AI_MODELS.extraction,
          messages: [
            { role: "system", content: "Você é um assistente que extrai questões estruturadas de textos de provas. Gere entre 4 e 5 alternativas por questão." }, 
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          // [AI_RESPONSE]
          const rawContent = aiData.choices?.[0]?.message?.content || "{}";
          console.log("[AI_RESPONSE] Received response from AI.");
          const parsed = parseAiJson(rawContent);
          questions = parsed.questions || [];
          console.log(`[AI_RESPONSE] LLM extracted ${questions.length} questions.`);
        } else {
          const errText = await aiResp.clone().text();
          console.error("[AI_REQUEST] LLM extraction failed HTTP:", aiResp.status, errText);
          await logPipelineAlert({
            source: "ingest-questions",
            message: `LLM extraction failed: ${aiResp.status}`,
            error_stack: errText,
            http_status: aiResp.status,
            model_used: AI_MODELS.extraction
          });
        }
      } catch (aiErr) {
        console.error("[AI_REQUEST] LLM extraction exception:", aiErr);
      }
    }

    if (questions.length === 0) {
      console.warn("[FINALIZE] No questions found after all attempts.");
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
        step: "FINALIZE"
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // [DB_INSERT]
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errorsCount = 0;

    console.log(`[DB_INSERT] Processing ${questions.length} potential questions for database...`);

    const existingMap = new Map<string, { id: string; statement: string }>();
    try {
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
    } catch (err) {
      console.error("[DB_INSERT] Failed to load existing questions for deduplication:", err);
    }

    const adminUserId = userId || "d342be08-4a6a-4183-94a0-fce42255cec1";

    for (const q of questions) {
      if (!isValidQuestion(q)) {
        errorsCount++;
        continue;
      }

      const normKey = normalizeText(q.statement).slice(0, 80);
      const match = existingMap.get(normKey);

      if (match) {
        if (q.correct_index >= 0 && q.explanation) {
          const { error: updErr } = await supabase.from("questions_bank").update({
            explanation: q.explanation,
            source_type,
            permission_type,
            source_url: sourceUrl,
          }).eq("id", match.id);
          if (updErr) {
            console.error(`[DB_INSERT] Update failed for ${match.id}:`, updErr);
            errorsCount++;
          } else {
            updated++;
          }
        } else {
          skipped++;
        }
      } else {
        // [DB_INSERT] Allow 4 or 5 options
        const opts = [...q.options];
        while (opts.length < 4) opts.push(`Alternativa ${String.fromCharCode(65 + opts.length)}`);
        if (opts.length > 5) opts.splice(5);

        // Correct index must be 0-4
        const correctIndex = Math.max(0, Math.min(q.correct_index, opts.length - 1));

        let difficulty = 3; 
        const textLen = q.statement.length;
        if (textLen > 1000 || /paciente de \d+ anos.*diagn[óo]stico/i.test(q.statement)) {
          difficulty = 4;
        } else if (textLen < 400 && !/diagn[óo]stico|tratamento/i.test(q.statement)) {
          difficulty = 2;
        }

        const payload = sanitizeForPostgres({
          statement: q.statement,
          options: opts,
          correct_index: correctIndex,
          topic: q.topic || banca || "Geral",
          subtopic: q.subtopic || "Geral",
          explanation: q.explanation || "",
          difficulty,
          year: year || new Date().getFullYear(),
          banca: banca || "Importação",
          language: "pt-BR",
          user_id: adminUserId,
          source_type,
          permission_type,
          source_url: sourceUrl
        });

        const { error: insErr } = await supabase.from("questions_bank").insert(payload);
        
        if (insErr) {
          console.error("[DB_INSERT] Insert failed:", insErr, JSON.stringify(payload).slice(0, 200));
          errorsCount++;
        } else {
          inserted++;
        }
      }
    }

    // [EMBEDDINGS]
    console.log(`[EMBEDDINGS] Final counts: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errorsCount} errors.`);

    await supabase.from("ingestion_log").insert({
      source_name: sourceName || (url ? `PDF: ${url}` : "unknown"),
      source_url: sourceUrl,
      source_type,
      permission_type,
      banca,
      year,
      questions_found: questions.length,
      questions_inserted: inserted,
      questions_updated: updated,
      duplicates_skipped: skipped,
      errors: errorsCount,
      status: "completed",
      created_by: userId,
    });

    return new Response(JSON.stringify({
      success: true,
      questions_found: questions.length,
      questions_inserted: inserted,
      questions_updated: updated,
      duplicates_skipped: skipped,
      errors: errorsCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[CRITICAL_ERROR] Uncaught exception in ingest-questions:", err);
    
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Unknown internal error",
      stack: err.stack || "not_applicable",
      step: "CRITICAL_ERROR",
      timestamp: new Date().toISOString()
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
