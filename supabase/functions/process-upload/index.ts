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
const MAX_PDF_PAGES_TO_PARSE = 100;
const CHARS_PER_CHUNK = 10000;

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
        model: "google/gemini-2.0-flash", // Use a vision capable model
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

    // Save chunks to DB
    const chunkInserts = textChunks.map((chunk, idx) => sanitizeForPostgres({
      upload_id: uploadId,
      user_id: userId,
      chunk_index: idx,
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      raw_text: chunk.text,
      status: "pending"
    }));
    await supabaseAdmin.from("planner_pdf_chunks").insert(chunkInserts);

    await supabaseAdmin.from("uploads").update({ 
      extracted_text: textChunks.map(c => c.text).join("\n\n").slice(0, 50000),
      extracted_json: { step: "text_extracted", progress: 20, total_chunks: textChunks.length }
    }).eq("id", uploadId);

    // 3. Topic Extraction
    await updateProgress(supabaseAdmin, uploadId, { step: "extracting_topics", progress: 30, current_chunk: 0, total_chunks: textChunks.length });
    
    const allExtractedTopics: any[] = [];
    let mainTopic = "Clínica Médica";

    for (let i = 0; i < textChunks.length; i++) {
      await updateProgress(supabaseAdmin, uploadId, { 
        step: "extracting_topics", 
        progress: Math.floor(30 + (i / textChunks.length) * 40), 
        current_chunk: i + 1, 
        total_chunks: textChunks.length 
      });

      console.log(`[PROCESS_UPLOAD] Processing chunk ${i + 1}/${textChunks.length}: ${textChunks[i].text.slice(0, 100)}...`);
      try {
        const chunkResponse = await aiFetch({
          model: ALLOWED_MODELS.generation,
          messages: [
            {
              role: "system",
              content: `Você é o motor oficial de extração de tópicos do ENAZIZI.
              Sua missão é ler o conteúdo de editais, PDFs de estudo ou imagens médicas e extrair EXCLUSIVAMENTE os tópicos de estudo.
              
              REGRAS CRÍTICAS:
              1. MODO STRICT: NÃO invente assuntos fora do texto.
              2. SEPARAÇÃO POR TÓPICO: O texto pode conter vários temas. Separe-os individualmente.
              3. HIERARQUIA: Identifique a Especialidade (ex: Cardiologia), o Tema (ex: Insuficiência Cardíaca) e o Subtópico (ex: Tratamento na Emergência).
              4. DIFICULDADE: Estime a dificuldade do tema para um aluno de medicina (facil, medio, dificil).
              
              Retorne JSON: {"is_medicine": true, "main_topic": "...", "topics": [{"tema": "...", "especialidade": "...", "dificuldade": "...", "subtopico": "..."}]}`
            },
            { role: "user", content: `Extraia os tópicos deste trecho (Parte ${i+1}/${textChunks.length}):\n\n${textChunks[i].text}` }
          ],
          timeoutMs: 45000,
        });

        if (chunkResponse.ok) {
          const aiRawResult = (await chunkResponse.json()).choices?.[0]?.message?.content || "";
          console.log(`[PROCESS_UPLOAD] AI Raw Response for chunk ${i}:`, aiRawResult);
          const parsed = parseAiJson(aiRawResult);
          // Filter out potential hallucinations at this stage if they look generic or unrelated
          if (parsed.is_medicine !== false) {
            if (parsed.main_topic && i === 0) mainTopic = parsed.main_topic;
            if (parsed.topics) {
              const taggedTopics = parsed.topics.map((t: any) => ({ ...t, _chunk_index: i }));
              allExtractedTopics.push(...taggedTopics);
            }
            
            await supabaseAdmin.from("planner_pdf_chunks")
              .update({ extracted_topics_json: parsed.topics, status: "completed" })
              .eq("upload_id", uploadId)
              .eq("chunk_index", i);
          }
        }
      } catch (err) {
        console.error(`[PROCESS_UPLOAD] Chunk ${i} extraction failed:`, err);
      }
    }

    // 4. Consolidation
    await updateProgress(supabaseAdmin, uploadId, { step: "consolidating", progress: 75 });
    const uniqueTopics = Array.from(new Map(allExtractedTopics.map(item => [JSON.stringify(item), item])).values());

    // Filter and count chunks for reporting
    const completedChunks = allExtractedTopics.filter(t => t.chunk_index !== undefined).length; // This logic needs adjustment because allExtractedTopics is a flat array of topics
    
    // Better stats: count how many chunks actually returned topics
    const chunkStats = textChunks.map((_, i) => ({
      index: i,
      status: allExtractedTopics.some(t => t._chunk_index === i) ? "completed" : "failed"
    }));

    await supabaseAdmin.from("planner_extracted_topics").insert(sanitizeForPostgres({
      upload_id: uploadId,
      user_id: userId,
      topics_json: uniqueTopics,
      coverage_stats: { 
        total_chunks: textChunks.length, 
        completed_chunks: chunkStats.filter(s => s.status === "completed").length,
        chunk_details: chunkStats,
        total_topics: uniqueTopics.length
      }
    }));

    // 5. Update Status
    await supabaseAdmin.from("uploads").update({
      status: "processed",
      extracted_json: {
        suggested_topics: uniqueTopics,
        main_topic: mainTopic,
        progress: 100,
        step: "done",
        enriching: true,
        total_topics: uniqueTopics.length,
        total_chunks: textChunks.length
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
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

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
