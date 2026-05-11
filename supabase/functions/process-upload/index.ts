import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";
import { aiFetch, sanitizeAiContent, parseAiJson } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NON_MEDICAL_CONTENT_REGEX = /(direito|jur[ií]d|penal|constitucional|processo penal|inquérito|inqu[eé]rito|stf|stj|delegad|advogad|pol[ií]cia federal|c[oó]digo penal|a[cç][aã]o penal|inform[aá]tica|tecnologia da informa[cç][aã]o|engenharia|contabilidade|economia|administra[cç][aã]o|programa[cç][aã]o|declara[cç][aã]o financeira|declara[cç][oõ]es de interesse|pagamento de qualquer esp[eé]cie|empresa farmac[eê]utica|ind[uú]stria farmac[eê]utica|honor[aá]rio|palestrante remunerado|v[ií]nculo empregat[ií]cio|conflito de interesse|relat[oó]rio de interesse|taxa de inscri|processo seletivo|per[ií]odo de inscri[cç][aã]o|edital de convoca|cronograma do processo|matr[ií]cula dos aprovados|homologa[cç][aã]o|classifica[cç][aã]o final|prazo de recurso|resultado preliminar|documenta[cç][aã]o exigida|valor da taxa|vagas reservadas|candidato inscrito|prova objetiva do processo)/i;
const MAX_PROCESS_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES_TO_PARSE = 50; // Reduced from 120 to save time/memory

async function extractPdfText(fileData: Blob): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    if (data.length < 5) throw new Error("Arquivo PDF corrompido ou muito pequeno.");
    const header = new TextDecoder().decode(data.slice(0, 5));
    if (header !== "%PDF-") {
      throw new Error("O arquivo não parece ser um PDF válido.");
    }

    console.log(`[PROCESS_UPLOAD] Extraindo texto de PDF (${data.length} bytes)...`);
    const document = await getDocument({ data, useSystemFonts: true }).promise;
    const totalPages = Math.min(document.numPages, MAX_PDF_PAGES_TO_PARSE);
    const pages: string[] = [];
    let collectedChars = 0;
    const maxCharsToCollect = 30000; // Reduced from 40k to speed up processing

    for (let i = 1; i <= totalPages; i++) {
      if (collectedChars >= maxCharsToCollect) break;
      try {
        const page = await document.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items
          .map((item: any) => item.str || "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (text) {
          pages.push(text);
          collectedChars += text.length;
        }
      } catch (e) {
        console.warn(`[PROCESS_UPLOAD] Failed to parse page ${i}, skipping.`);
      }
    }

    return pages.join("\n\n").slice(0, maxCharsToCollect);
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
    let extractedText = "";

    if (fileType === "txt") extractedText = await fileData.text();
    else if (fileType === "pdf" || fileType.includes("pdf")) extractedText = await extractPdfText(fileData);
    else if (fileType === "docx" || fileType.includes("wordprocessingml")) extractedText = await extractDocxText(fileData);
    else throw new Error("Unsupported format");

    const truncatedText = (extractedText || "").trim().slice(0, 30000);
    if (!truncatedText) {
      await supabaseAdmin.from("uploads").update({ 
        status: "error", 
        extracted_json: { error: "Sem texto extraível no PDF.", step: "extraction" } 
      }).eq("id", uploadId);
      return;
    }

    await supabaseAdmin.from("uploads").update({ extracted_text: truncatedText }).eq("id", uploadId);

    // 3. Validation & Topics (PRIORITY: Must finish to return base plan)
    await updateProgress(supabaseAdmin, uploadId, { step: "validating_content", progress: 25 });
    
    let detectedTopic = "Clínica Médica";
    let suggestedTopics: any[] = [];
    
    const valResponse = await aiFetch({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Analise o texto médico e sugira 3-8 tópicos de estudo. 
          Retorne JSON: {"is_medicine": true, "main_topic": "...", "topics": [{"tema": "...", "especialidade": "...", "dificuldade": "...", "subtopico": "..."}]}`
        },
        { role: "user", content: `Analise:\n\n${truncatedText.slice(0, 8000)}` }
      ],
      timeoutMs: 55000,
    });

    if (valResponse.ok) {
      const parsed = parseAiJson((await valResponse.json()).choices?.[0]?.message?.content || "");
      if (!parsed.is_medicine) {
        await supabaseAdmin.from("uploads").update({
          status: "error",
          extracted_json: { error: "Conteúdo não médico.", step: "validation" }
        }).eq("id", uploadId);
        return;
      }
      detectedTopic = parsed.main_topic || detectedTopic;
      suggestedTopics = parsed.topics || [];
    }

    // UPDATE PROGRESS: BASE PLAN READY
    await supabaseAdmin.from("uploads").update({
      status: "processed", // Marcar como "processed" para liberar os tópicos na UI imediatamente
      extracted_json: {
        suggested_topics: suggestedTopics,
        main_topic: detectedTopic,
        progress: 100,
        step: "done",
        enriching: true, // Flag para indicar que flashcards/questões virão depois
      }
    }).eq("id", uploadId);

    // 4. Enrichment (Flashcards/Questions) - Sequential to avoid concurrent AI timeouts
    await updateProgress(supabaseAdmin, uploadId, { 
      step: "generating_flashcards", 
      progress: 60, 
      suggested_topics: suggestedTopics,
      main_topic: detectedTopic 
    });

    let flashcardsCount = 0;
    try {
      const fcRes = await aiFetch({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: 'Gere 5-8 flashcards relevantes. JSON: {"flashcards": [{"question": "...", "answer": "...", "topic": "..."}]}' },
          { role: "user", content: `Gere flashcards:\n\n${truncatedText.slice(0, 10000)}` }
        ],
        timeoutMs: 55000,
      });
      if (fcRes.ok) {
        const parsed = parseAiJson((await fcRes.json()).choices?.[0]?.message?.content || "");
        const flashcards = (parsed.flashcards || []).map((fc: any) => ({
          user_id: userId, question: fc.question, answer: fc.answer, topic: fc.topic || detectedTopic, is_global: true
        })).filter((fc: any) => fc.question && fc.answer && !NON_MEDICAL_CONTENT_REGEX.test(fc.question));
        if (flashcards.length > 0) {
          const { error } = await supabaseAdmin.from("flashcards").insert(flashcards);
          if (!error) flashcardsCount = flashcards.length;
        }
      }
    } catch (e) { console.warn("[PROCESS_UPLOAD] Flashcards enrichment failed."); }

    await updateProgress(supabaseAdmin, uploadId, { 
      step: "generating_questions", 
      progress: 80, 
      flashcards_count: flashcardsCount,
      suggested_topics: suggestedTopics,
      main_topic: detectedTopic 
    });

    let questionsCount = 0;
    try {
      const qRes = await aiFetch({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: 'Gere 5-8 questões. JSON: {"questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "correct_index": 0, "explanation": "...", "topic": "..."}]}' },
          { role: "user", content: `Gere questões:\n\n${truncatedText.slice(0, 10000)}` }
        ],
        timeoutMs: 55000,
      });
      if (qRes.ok) {
        const parsed = parseAiJson((await qRes.json()).choices?.[0]?.message?.content || "");
        const questions = (parsed.questions || []).map((q: any) => ({
          user_id: userId, statement: q.statement, options: q.options, correct_index: q.correct_index,
          explanation: q.explanation, topic: q.topic || detectedTopic, source: `upload:${upload.filename}`,
          is_global: true, review_status: "pending"
        })).filter((q: any) => q.statement && q.options?.length >= 4 && !NON_MEDICAL_CONTENT_REGEX.test(q.statement));
        if (questions.length > 0) {
          const { error } = await supabaseAdmin.from("questions_bank").insert(questions);
          if (!error) questionsCount = questions.length;
        }
      }
    } catch (e) { console.warn("[PROCESS_UPLOAD] Questions enrichment failed."); }

    // Final Final Update
    await supabaseAdmin.from("uploads").update({
      extracted_json: {
        flashcards_count: flashcardsCount,
        questions_count: questionsCount,
        suggested_topics: suggestedTopics,
        main_topic: detectedTopic,
        progress: 100,
        step: "done",
        enriching: false
      }
    }).eq("id", uploadId);

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
