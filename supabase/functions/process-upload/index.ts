import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";
import { aiFetch, sanitizeAiContent, parseAiJson } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { logPipelineAlert } from "../_shared/pipeline-logger.ts";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NON_MEDICAL_CONTENT_REGEX = /(direito|jur[ií]d|penal|constitucional|processo penal|inquérito|inqu[eé]rito|stf|stj|delegad|advogad|pol[ií]cia federal|c[oó]digo penal|a[cç][aã]o penal|inform[aá]tica|tecnologia da informa[cç][aã]o|engenharia|contabilidade|economia|administra[cç][aã]o|programa[cç][aã]o|declara[cç][aã]o financeira|declara[cç][oõ]es de interesse|pagamento de qualquer esp[eé]cie|empresa farmac[eê]utica|ind[uú]stria farmac[eê]utica|honor[aá]rio|palestrante remunerado|v[ií]nculo empregat[ií]cio|conflito de interesse|relat[oó]rio de interesse|taxa de inscri|processo seletivo|per[ií]odo de inscri[cç][aã]o|edital de convoca|cronograma do processo|matr[ií]cula dos aprovados|homologa[cç][aã]o|classifica[cç][aã]o final|prazo de recurso|resultado preliminar|documenta[cç][aã]o exigida|valor da taxa|vagas reservadas|candidato inscrito|prova objetiva do processo)/i;
const MAX_PROCESS_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES_TO_PARSE = 200;
const CHARS_PER_CHUNK = 12000;

async function extractPdfTextChunks(fileData: Blob): Promise<{ text: string, pageStart: number, pageEnd: number }[]> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    if (data.length < 5) throw new Error("Arquivo PDF corrompido ou muito pequeno.");
    const header = new TextDecoder().decode(data.slice(0, 5));
    if (header !== "%PDF-") throw new Error("O arquivo não parece ser um PDF válido.");

    console.log(`[PROCESS_UPLOAD] Extraindo texto de PDF (${data.length} bytes)...`);
    const document = await getDocument({ data, useSystemFonts: true }).promise;
    const totalPages = Math.min(document.numPages, MAX_PDF_PAGES_TO_PARSE);
    
    const chunks: { text: string, pageStart: number, pageEnd: number }[] = [];
    let currentChunkText = "";
    let chunkPageStart = 1;

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await document.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (text) {
          if (currentChunkText.length + text.length > CHARS_PER_CHUNK && currentChunkText.length > 0) {
            chunks.push({ text: currentChunkText, pageStart: chunkPageStart, pageEnd: i - 1 });
            currentChunkText = text;
            chunkPageStart = i;
          } else {
            currentChunkText += (currentChunkText ? "\n\n" : "") + text;
          }
        }
      } catch (e) {
        console.warn(`[PROCESS_UPLOAD] Failed to parse page ${i}, skipping.`);
      }
    }

    if (currentChunkText) {
      chunks.push({ text: currentChunkText, pageStart: chunkPageStart, pageEnd: totalPages });
    }

    return chunks;
  } catch (err: any) {
    console.error("[PROCESS_UPLOAD] PDF Extraction error:", err);
    throw new Error(`Falha ao ler PDF: ${err.message}`);
  }
}

async function extractDocxText(fileData: Blob): Promise<string> {
  try {
    const { ZipReader, BlobReader, TextWriter } = await import("https://esm.sh/@zip.js/zip.js@2.7.34");
    const zipReader = new ZipReader(new BlobReader(fileData));
    const entries = await zipReader.getEntries();
    const docEntry = entries.find((e: any) => e.filename === "word/document.xml");
    if (!docEntry) return "";
    const xml = await docEntry.getData!(new TextWriter());
    await zipReader.close();
    return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch (err) {
    throw new Error("Falha ao ler documento DOCX.");
  }
}

async function updateProgress(supabaseAdmin: any, uploadId: string, progress: Record<string, any>) {
  await supabaseAdmin.from("uploads").update({
    extracted_json: progress,
  }).eq("id", uploadId);
}

async function processInBackground(
  uploadId: string,
  upload: any,
  userId: string,
  supabaseAdmin: any,
  supabase: any,
) {
  console.log(`[PROCESS_UPLOAD] Background processing for ${uploadId}...`);
  try {
    // 1. Download
    await updateProgress(supabaseAdmin, uploadId, { step: "downloading", progress: 5 });
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("user-uploads")
      .download(upload.storage_path);

    if (downloadError || !fileData) throw new Error("Download failed");

    // 2. Extract
    await updateProgress(supabaseAdmin, uploadId, { step: "extracting_text", progress: 15 });
    const fileType = (upload.file_type || "").toLowerCase();
    let textChunks: { text: string, pageStart: number, pageEnd: number }[] = [];

    if (fileType === "txt" || fileType.includes("text/plain")) {
      const text = await fileData.text();
      textChunks = [{ text, pageStart: 1, pageEnd: 1 }];
    } else if (fileType === "pdf" || fileType.includes("pdf") || upload.filename.toLowerCase().endsWith(".pdf")) {
      textChunks = await extractPdfTextChunks(fileData);
    } else if (fileType === "docx" || fileType.includes("wordprocessingml") || upload.filename.toLowerCase().endsWith(".docx")) {
      const text = await extractDocxText(fileData);
      textChunks = [{ text, pageStart: 1, pageEnd: 1 }];
    } else if (fileType.includes("image") || ["jpg", "jpeg", "png", "webp"].includes(fileType) || [".jpg", ".jpeg", ".png", ".webp"].some(ext => upload.filename.toLowerCase().endsWith(ext))) {
      // OCR for images
      console.log(`[PROCESS_UPLOAD] Performing OCR on image...`);
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const ocrResponse = await aiFetch({
        model: "google/gemini-2.5-flash", // Use a vision capable model
        messages: [

          {
            role: "user",
            content: [
              { type: "text", text: "Extraia todo o texto médico/educativo desta imagem. Retorne apenas o texto extraído, sem comentários." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
            ]
          }
        ],
        timeoutMs: 60000,
      });

      if (!ocrResponse.ok) throw new Error("Falha no OCR da imagem.");
      const ocrResult = await ocrResponse.json();
      const text = ocrResult.choices?.[0]?.message?.content || "";
      textChunks = [{ text, pageStart: 1, pageEnd: 1 }];
    } else {
      throw new Error(`Formato não suportado: ${fileType}`);
    }

    if (textChunks.length === 0) {
      await supabaseAdmin.from("uploads").update({ 
        status: "error", 
        extracted_json: { error: "Sem texto extraível no arquivo.", step: "extraction" } 
      }).eq("id", uploadId);
      return;
    }

    // Save chunks to DB first to get IDs
    const { data: insertedChunks, error: chunkErr } = await supabaseAdmin
      .from("planner_pdf_chunks")
      .insert(textChunks.map((chunk, idx) => sanitizeForPostgres({
        upload_id: uploadId,
        user_id: userId,
        chunk_index: idx,
        page_start: chunk.pageStart,
        page_end: chunk.pageEnd,
        raw_text: chunk.text,
        status: "pending"
      })))
      .select("id, chunk_index");

    if (chunkErr) throw chunkErr;

    await supabaseAdmin.from("uploads").update({ 
      extracted_text: textChunks.map(c => c.text).join("\n\n").slice(0, 50000),
      extracted_json: { step: "text_extracted", progress: 20, total_chunks: textChunks.length }
    }).eq("id", uploadId);

    // 3. Date and Topic Extraction
    await updateProgress(supabaseAdmin, uploadId, { step: "analyzing_document", progress: 30, current_chunk: 0, total_chunks: textChunks.length });
    
    let detectedExamDate: string | null = null;
    const allExtractedTopics: any[] = [];
    let mainTopic = "Clínica Médica";

    // Analyze start of document for dates
    const initialText = textChunks.map(c => c.text).join("\n\n").slice(0, 15000); 
    try {
      const dateResponse = await aiFetch({
        model: ALLOWED_MODELS.generation,
        messages: [
          {
            role: "system",
            content: `Você é um especialista em editais médicos. 
            Identifique a DATA DA PROVA no texto.
            Retorne JSON: {"exam_date": "YYYY-MM-DD" | null, "reason": "..."}`
          },
          { role: "user", content: `Extraia a data da prova:\n\n${initialText}` }
        ],
        timeoutMs: 30000,
      });

      if (dateResponse.ok) {
        const dateJson = parseAiJson((await dateResponse.json()).choices?.[0]?.message?.content || "{}");
        if (dateJson.exam_date) detectedExamDate = dateJson.exam_date;
      }
    } catch (e) {
      console.warn("[PROCESS_UPLOAD] Date detection failed", e);
    }

    for (let i = 0; i < textChunks.length; i++) {
      await updateProgress(supabaseAdmin, uploadId, { 
        step: "extracting_topics", 
        progress: Math.floor(40 + (i / textChunks.length) * 40), 
        current_chunk: i + 1, 
        total_chunks: textChunks.length 
      });

      const chunkId = insertedChunks.find(c => c.chunk_index === i)?.id;
      try {
        const chunkResponse = await aiFetch({
          model: ALLOWED_MODELS.generation,
          messages: [
            {
              role: "system",
              content: `Você é o motor oficial de extração de tópicos do ENAZIZI.
              Extraia EXCLUSIVAMENTE tópicos de estudo que aparecem LITERALMENTE no texto fornecido.
              
              REGRAS CRÍTICAS:
              1. NÃO INVENTE temas que não estão no texto.
              2. Capture o 'raw_excerpt' exato do texto que justifica a existência do tópico.
              3. Identifique a disciplina médica correta (Cardiologia, Pediatria, etc).
              4. Atribua um 'confidence' de 0 a 1 baseado na clareza do tópico no texto.
              
              Retorne JSON: {"is_medicine": true, "topics": [{"tema": "...", "especialidade": "...", "subtopico": "...", "raw_excerpt": "...", "page": number, "confidence": 0-1}]}`
            },
            { role: "user", content: `Extraia tópicos do material médico (Parte ${i+1}):\n\n${textChunks[i].text}` }
          ],
          timeoutMs: 45000,
        });

        if (chunkResponse.ok) {
          const rawContent = (await chunkResponse.json()).choices?.[0]?.message?.content || "{}";
          const parsed = parseAiJson(rawContent);
          
          if (parsed.topics && parsed.topics.length > 0) {
            const topicsToInsert = parsed.topics.map((t: any) => sanitizeForPostgres({
              user_id: userId,
              upload_id: uploadId,
              discipline: t.especialidade || t.discipline || "Geral",
              topic: t.tema,
              subtopic: t.subtopico,
              source_page: t.page || textChunks[i].pageStart,
              source_chunk_id: chunkId,
              raw_excerpt: t.raw_excerpt || "Excerto não capturado pela IA",
              confidence_score: t.confidence || 0.8,
              validation_status: 'extracted'
            }));
            
            const { error: insertErr } = await supabaseAdmin.from("planner_extracted_topics").insert(topicsToInsert);
            if (insertErr) console.error("[PROCESS_UPLOAD] Error inserting topics:", insertErr);
            allExtractedTopics.push(...parsed.topics);
          }
          await supabaseAdmin.from("planner_pdf_chunks").update({ status: "completed" }).eq("id", chunkId);
        }
      } catch (err) {
        console.error(`[PROCESS_UPLOAD] Chunk ${i} failed:`, err);
      }
    }

    // 4. Update Status
    await supabaseAdmin.from("uploads").update({
      status: "processed",
      extracted_json: {
        detected_exam_date: detectedExamDate,
        suggested_topics: allExtractedTopics.slice(0, 100), // Keep a sample in JSON
        progress: 100,
        step: "done",
        total_topics: allExtractedTopics.length
      }
    }).eq("id", uploadId);


    // 6. Enrichment - Disabled in strict mode, but we keep it minimal for non-strict contexts if needed.
    // However, per instructions, we should disable automatic enrichment that might cause drift.
    console.log("[PROCESS_UPLOAD] Automatic enrichment (flashcards/questions) starting...");
    try {
      // Trigger populate-questions to generate content from the extracted text
      const populateResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/populate-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ uploadId }),
      });
      
      if (!populateResponse.ok) {
        console.warn(`[PROCESS_UPLOAD] Failed to trigger populate-questions: ${populateResponse.status}`);
      } else {
        console.log("[PROCESS_UPLOAD] populate-questions triggered successfully");
      }
    } catch (enrichErr) {
      console.error("[PROCESS_UPLOAD] Enrichment error:", enrichErr);
    }
    
    // We don't update counts here anymore as populate-questions will handle it asynchronously.
    // We only ensure the status is 'processed' for the extraction phase.

    const ragDocId = (upload.extracted_json as any)?.rag_doc_id;
    if (ragDocId) {
      await supabaseAdmin.from("rag_documents").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", ragDocId);
    }

  } catch (err: any) {
    console.error("[PROCESS_UPLOAD] Error:", err);
    await supabaseAdmin.from("uploads").update({
      status: "error",
      extracted_json: { error: err.message || "Erro inesperado.", step: "fatal" }
    }).eq("id", uploadId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });


    const { uploadId } = await req.json();
    if (!uploadId) throw new Error("uploadId required");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: upload } = await supabaseAdmin.from("uploads").select("*").eq("id", uploadId).maybeSingle();
    if (!upload) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });

    const { data: profile } = await supabaseAdmin.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
    const orgId = profile?.organization_id || "00000000-0000-0000-0000-000000000000";

    const { data: ragDoc } = await supabaseAdmin.from("rag_documents").upsert({
      organization_id: orgId, uploaded_by: user.id, title: upload.filename, file_name: upload.filename,
      file_path: upload.storage_path, file_type: upload.file_type || "unknown", file_size: upload.file_size || 0, status: "processing"
    }).select().single();

    await supabaseAdmin.from("uploads").update({
      status: "processing", organization_id: orgId,
      extracted_json: { ...upload.extracted_json, step: "starting", progress: 0, rag_doc_id: ragDoc?.id },
    }).eq("id", uploadId);

    // @ts-ignore
    EdgeRuntime.waitUntil(processInBackground(uploadId, upload, user.id, supabaseAdmin, supabase));

    return new Response(JSON.stringify({ success: true, message: "Pipeline iniciado", uploadId }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
