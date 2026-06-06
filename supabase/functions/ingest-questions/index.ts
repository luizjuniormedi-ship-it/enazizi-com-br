
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getServiceClient, logPipelineAlert } from "../_shared/pipeline-logger.ts";
import { aiFetch } from "../_shared/ai-fetch.ts";
import { parseAiJson } from "../_shared/enterprise-edge/parse-ai-json.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";
import { getDocument } from "https://esm.sh/pdfjs-serverless";

// ─── CONSTANTS & PATTERNS ─────────────────────────────────────────────────────
const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir)\b/i;
const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female)\b/i;

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

function isValidQuestion(q: { statement?: string; options?: string[]; correct_index?: number }): boolean {
  if (!q.statement || !Array.isArray(q.options) || typeof q.correct_index !== "number") return false;
  if (q.options.length < 4) return false;
  if (q.statement.length < 50) return false;
  if (IMAGE_REF_PATTERN.test(q.statement)) return false;
  if (ENGLISH_PATTERN.test(q.statement)) return false;
  const validOpts = q.options.filter(o => String(o).trim().length > 0);
  return validOpts.length >= 4;
}

async function extractPdfTextFromBytes(data: Uint8Array): Promise<string> {
  console.log("[PDF_PARSE] Extracting text...");
  try {
    const document = await getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= document.numPages; i++) {
      const page = await document.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => (item?.str || "")).join(" ").replace(/\s+/g, " ").trim();
      if (text) pages.push(text);
    }
    return pages.join("\n\n");
  } catch (err) {
    console.error("[PDF_PARSE] Error:", err);
    return "";
  }
}

function normalizePdfExamText(text: string): string {
  return text
    .replace(/Quest[\S]{0,3}o(?=\s+\d)/gi, "QUESTÃO")
    .replace(/Medway\s*-\s*ENARE\s*-\s*\d{4}\s*P[aá]ginas?\s*\d+\/\d+/gi, " ")
    .replace(/ENARE-\d{4}-Objetiva\s*\|\s*R1/gi, " ")
    .replace(/P[aá]ginas?\s*\d+\/\d+/gi, " ")
    .replace(/proibida\s+venda[^\n]{0,80}/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuestionsFromPdfExamText(text: string, fallbackTopic: string): any[] {
  const cleaned = normalizePdfExamText(text);
  const blocks = cleaned.split(/(?=QUEST[ÃA]O\s+\d+[\s\.:])/i).map(b => b.trim()).filter(Boolean);
  const questions: any[] = [];
  for (const rawBlock of blocks) {
    let block = rawBlock.replace(/^QUEST[ÃA]O\s+\d+[\s\.:]*/i, "").trim();
    const markerRegex = /(?:^|[\s\n])([A-E])(?:[\.)\-]\s|\s+(?=[A-ZÀ-Úa-zà-ú0-9]))/g;
    const allMarkers = Array.from(block.matchAll(markerRegex)).map(m => ({
      letter: m[1],
      rawIndex: m.index ?? 0,
      start: (m.index ?? 0) + m[0].length,
    }));
    const sequence = ["A", "B", "C", "D", "E"];
    const markers: any[] = [];
    let seqIdx = 0;
    for (const m of allMarkers) {
      if (m.letter === sequence[seqIdx]) { markers.push(m); seqIdx++; if (seqIdx >= 5) break; }
    }
    if (markers.length < 4) continue;
    const statement = block.slice(0, markers[0].rawIndex).trim();
    if (statement.length < 50) continue;
    const options: string[] = [];
    for (let i = 0; i < markers.length && i < 5; i++) {
      const start = markers[i].start;
      const end = i + 1 < markers.length ? markers[i + 1].rawIndex : block.length;
      const option = block.slice(start, end).trim().replace(/^[\-–—:;\s]+/, "").replace(/\s+/g, " ").trim();
      if (option) options.push(option);
    }
    if (options.length < 4) continue;
    const gabaritoMatch = block.match(/(?:gabarito|resposta|alternativa)\s*[:=\-]?\s*([A-E])/i);
    const correctIndex = gabaritoMatch ? gabaritoMatch[1].toUpperCase().charCodeAt(0) - 65 : 0;
    questions.push({
      statement, options, topic: fallbackTopic, subtopic: "Geral", explanation: "",
      correct_index: Math.max(0, Math.min(correctIndex, options.length - 1))
    });
  }
  return questions;
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) userId = user.id;
    }

    const body = await req.json().catch(() => ({}));
    const { mode, url, upload_id, banca, year, source_type = "unknown", permission_type = "unknown" } = body;

    if (!mode) return new Response(JSON.stringify({ success: true, stage: "BOOT_OK", function: "ingest-questions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    console.log(`[EXEC] Mode: ${mode}`);

    if (mode === "web_navigate") {
      if (!url) throw new Error("URL required");
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      let pageText = "";
      if (firecrawlKey) {
        try {
          const fcResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${firecrawlKey}` },
            body: JSON.stringify({ url, formats: ["markdown"] }),
          });
          const fcData = await fcResp.json();
          pageText = fcData?.data?.markdown || "";
        } catch (e) { console.error("Firecrawl error:", e); }
      }
      if (!pageText) {
        const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        pageText = await resp.text();
      }
      const pdfLinks: any[] = [];
      const matches = pageText.match(/https?:\/\/[^\s"'<>]+\.pdf/gi) || [];
      for (const m of matches) {
        const yearMatch = m.match(/(20\d{2})/);
        pdfLinks.push({ name: m.split("/").pop() || "prova.pdf", url: m, year: yearMatch ? parseInt(yearMatch[1]) : undefined });
      }
      await supabase.from("ingestion_log").insert({ source_name: `Web: ${url}`, source_url: url, source_type: "indexed_external", status: "navigated", created_by: userId });
      return new Response(JSON.stringify({ success: true, pdf_links: pdfLinks }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "index_only") {
      const { data: log } = await supabase.from("ingestion_log").insert({
        source_name: body.source_name || `Indexed: ${url || "unknown"}`, source_url: url, source_type, banca, year, status: "indexed", created_by: userId
      }).select().single();
      return new Response(JSON.stringify({ success: true, log }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let fullText = "";
    let sourceName = "";
    let questions: any[] = [];

    if (mode === "pdf_url" && url) {
      sourceName = `URL: ${url}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to download PDF: ${resp.status}`);
      const pdfBytes = new Uint8Array(await resp.arrayBuffer());
      fullText = await extractPdfTextFromBytes(pdfBytes);
      questions = parseQuestionsFromPdfExamText(fullText, banca || "Geral");
    } else if (mode === "upload" && upload_id) {
      const { data: upload } = await supabase.from("uploads").select("*").eq("id", upload_id).single();
      if (!upload) throw new Error("Upload not found");
      sourceName = `Upload: ${upload.filename}`;
      if (upload.storage_path) {
        const { data: fileData } = await supabase.storage.from("user-uploads").download(upload.storage_path);
        if (fileData) {
          if (upload.filename.toLowerCase().endsWith(".pdf")) {
            fullText = await extractPdfTextFromBytes(new Uint8Array(await fileData.arrayBuffer()));
          } else { fullText = await fileData.text(); }
        }
      }
      if (!fullText && upload.extracted_text) fullText = upload.extracted_text;
      questions = parseQuestionsFromPdfExamText(fullText, banca || "Geral");
    } else if (mode === "direct_text" && body.text) {
      fullText = body.text;
      sourceName = "Direct Text Import";
      questions = parseQuestionsFromPdfExamText(fullText, banca || "Geral");
    }

    if (questions.length < 5 && fullText.length > 100) {
      const aiResp = await aiFetch({
        model: ALLOWED_MODELS.generation,
        messages: [
          { role: "system", content: "Extraia questões médicas de residência em JSON estruturado." },
          { role: "user", content: `Texto:\n${fullText.slice(0, 15000)}\n\nFormato: {"questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_index": 0}]}` }
        ],
        response_format: { type: "json_object" }
      });
      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const parsed = parseAiJson(aiData.choices?.[0]?.message?.content || "{}");
        if (Array.isArray(parsed.questions)) {
          // Add only unique questions (simple check)
          for (const aq of parsed.questions) {
            if (!questions.some(q => q.statement.slice(0, 50) === aq.statement.slice(0, 50))) {
              questions.push(aq);
            }
          }
        }
      }
    }

    const validQuestions = questions.filter(isValidQuestion);
    for (const q of validQuestions) {
      const topicName = q.topic || banca || "Geral";
      
      // Lookup specialty_id
      const { data: specData } = await supabase.from("curriculum_specialties")
        .select("id")
        .ilike("nome", topicName.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
        .maybeSingle();

      const { data: question, error: insertError } = await supabase.from("questions_bank").insert({
        statement: sanitizeForPostgres(q.statement),
        options: q.options,
        correct_index: q.correct_index ?? q.correctIndex ?? 0,
        explanation: q.explanation || "",
        topic: topicName,
        specialty_id: specData?.id,
        subtopic: q.subtopic || "Geral",
        year: year || new Date().getFullYear(),
        board: banca || "Geral", 
        institution: banca || "Geral",
        difficulty: 3,
        is_global: true,
        source_url: url || "",
        user_id: userId,
        quality_tier: "basic"
      }).select().single();
      
      if (insertError) {
        console.error("[INGEST] Error inserting question:", insertError);
      }
    }

    await supabase.from("ingestion_log").insert({ source_name: sourceName, source_url: url, questions_found: validQuestions.length, status: "completed", created_by: userId });

    return new Response(JSON.stringify({ success: true, questions_found: questions.length, questions_inserted: validQuestions.length, stage: "COMPLETED" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[ERR]", err);
    return new Response(JSON.stringify({ success: false, error: String(err), stage: "BOOT_CATCH" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
