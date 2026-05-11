import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";
import { aiFetch, sanitizeAiContent, parseAiJson } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NON_MEDICAL_CONTENT_REGEX = /(direito|jur[ií]d|penal|constitucional|processo penal|inquérito|inqu[eé]rito|stf|stj|delegad|advogad|pol[ií]cia federal|c[oó]digo penal|a[cç][aã]o penal|inform[aá]tica|tecnologia da informa[cç][aã]o|engenharia|contabilidade|economia|administra[cç][aã]o|programa[cç][aã]o|declara[cç][aã]o financeira|declara[cç][oõ]es de interesse|pagamento de qualquer esp[eé]cie|empresa farmac[eê]utica|ind[uú]stria farmac[eê]utica|honor[aá]rio|palestrante remunerado|v[ií]nculo empregat[ií]cio|conflito de interesse|relat[oó]rio de interesse|taxa de inscri|processo seletivo|per[ií]odo de inscri[cç][aã]o|edital de convoca|cronograma do processo|matr[ií]cula dos aprovados|homologa[cç][aã]o|classifica[cç][aã]o final|prazo de recurso|resultado preliminar|documenta[cç][aã]o exigida|valor da taxa|vagas reservadas|candidato inscrito|prova objetiva do processo)/i;
const MAX_PROCESS_FILE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES_TO_PARSE = 120;

async function extractPdfText(fileData: Blob): Promise<string> {
  try {
    const arrayBuffer = await fileData.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    if (data.length < 5) throw new Error("Arquivo PDF corrompido ou muito pequeno.");
    const header = new TextDecoder().decode(data.slice(0, 5));
    if (header !== "%PDF-") {
      console.error("[PROCESS_UPLOAD] Invalid PDF header:", header);
      throw new Error("O arquivo não parece ser um PDF válido.");
    }

    console.log(`[PROCESS_UPLOAD] Extraindo texto de PDF (${data.length} bytes)...`);
    const document = await getDocument({ data, useSystemFonts: true }).promise;
    const totalPages = Math.min(document.numPages, MAX_PDF_PAGES_TO_PARSE);
    const pages: string[] = [];
    let collectedChars = 0;
    const maxCharsToCollect = 40000;

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
        console.warn(`[PROCESS_UPLOAD] Failed to parse page ${i}, skipping:`, e);
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
    console.error("[PROCESS_UPLOAD] DOCX Extraction error:", err);
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
  console.log(`[PROCESS_UPLOAD] Starting background processing for ${uploadId}...`);
  try {
    // Step 1: Download file
    await updateProgress(supabaseAdmin, uploadId, { step: "downloading", progress: 5 });

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("user-uploads")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Falha ao baixar arquivo: ${downloadError?.message || "Sem dados"}`);
    }

    const fileSize = fileData.size || (upload.extracted_json as any)?.file_size || 0;
    if (fileSize > MAX_PROCESS_FILE_BYTES) {
      throw new Error("Arquivo muito grande (máx 20MB)");
    }

    // Step 2: Extract text
    await updateProgress(supabaseAdmin, uploadId, { step: "extracting_text", progress: 15 });
    const fileType = (upload.file_type || "").toLowerCase();
    let extractedText = "";

    if (fileType === "txt") {
      extractedText = await fileData.text();
    } else if (fileType === "pdf" || fileType.includes("pdf")) {
      extractedText = await extractPdfText(fileData);
    } else if (fileType === "docx" || fileType.includes("wordprocessingml")) {
      extractedText = await extractDocxText(fileData);
    } else {
      throw new Error(`Formato não suportado: ${fileType}`);
    }

    const truncatedText = (extractedText || "").trim().slice(0, 40000);

    if (!truncatedText) {
      console.warn(`[PROCESS_UPLOAD] No text extracted for ${uploadId}`);
      await supabaseAdmin.from("uploads").update({ 
        status: "error", 
        extracted_json: { 
          error: "O PDF não possui texto extraível (pode ser uma imagem escaneada).", 
          details: "Tente enviar um PDF pesquisável ou documento de texto.",
          step: "extraction" 
        } 
      }).eq("id", uploadId);
      return;
    }

    // Step 3: Combined AI Validation & Topic Suggestion
    await updateProgress(supabaseAdmin, uploadId, { step: "validating_content", progress: 25 });
    
    let detectedTopic = "Clínica Médica";
    let suggestedTopics: any[] = [];
    
    try {
      const valResponse = await aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Analise o texto e:
            1. Verifique se é conteúdo MÉDICO CLÍNICO. (Editais/Inscrições = false).
            2. Sugira 3 a 8 tópicos de estudo. Cada tópico: tema, especialidade, dificuldade (facil/medio/dificil), subtopico.
            Responda APENAS JSON: {"is_medicine": true, "main_topic": "...", "topics": [...]}`
          },
          { role: "user", content: `Analise este texto:\n\n${truncatedText.slice(0, 5000)}` }
        ],
        timeoutMs: 60000,
      });

      if (valResponse.ok) {
        const valData = await valResponse.json();
        const content = valData.choices?.[0]?.message?.content || "";
        const parsed = parseAiJson(content);
        
        if (!parsed.is_medicine) {
          console.warn(`[PROCESS_UPLOAD] Non-medical content detected for ${uploadId}`);
          await supabaseAdmin.from("uploads").update({
            status: "error",
            extracted_json: { error: "Conteúdo não parece ser médico/clínico.", step: "validation" }
          }).eq("id", uploadId);
          return;
        }
        
        detectedTopic = parsed.main_topic || detectedTopic;
        suggestedTopics = parsed.topics || [];
      }
    } catch (e) {
      console.error("[PROCESS_UPLOAD] AI Validation/Topic error:", e);
      // Fallback is to continue with defaults if validation fails but extraction worked
    }

    // Step 4: Parallel generation of Flashcards and Questions
    await updateProgress(supabaseAdmin, uploadId, { step: "generating_resources", progress: 50, main_topic: detectedTopic });

    const [flashcardsRes, questionsRes] = await Promise.allSettled([
      // Flashcards Task
      aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: 'Crie 5-12 flashcards relevantes para Residência Médica. Responda JSON: {"flashcards": [{"question": "...", "answer": "...", "topic": "..."}]}' },
          { role: "user", content: `Gere flashcards:\n\n${truncatedText.slice(0, 8000)}` }
        ],
        timeoutMs: 60000,
      }),
      // Questions Task
      aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: 'Gere 10-15 questões de múltipla escolha (A-E). Responda JSON: {"questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "correct_index": 0, "explanation": "...", "topic": "..."}]}' },
          { role: "user", content: `Gere questões para ${detectedTopic}:\n\n${truncatedText.slice(0, 8000)}` }
        ],
        timeoutMs: 60000,
      })
    ]);

    let flashcardsCount = 0;
    let questionsCount = 0;

    // Process Flashcards
    if (flashcardsRes.status === "fulfilled" && flashcardsRes.value.ok) {
      try {
        const data = await flashcardsRes.value.json();
        const content = data.choices?.[0]?.message?.content || "";
        const parsed = parseAiJson(content);
        const flashcards = (parsed.flashcards || [])
          .map((fc: any) => ({
            user_id: userId,
            question: String(fc.question || "").trim(),
            answer: String(fc.answer || "").trim(),
            topic: String(fc.topic || detectedTopic).trim(),
            is_global: true
          }))
          .filter((fc: any) => fc.question && fc.answer && !NON_MEDICAL_CONTENT_REGEX.test(`${fc.topic} ${fc.question}`));
        
        if (flashcards.length > 0) {
          const { error } = await supabaseAdmin.from("flashcards").insert(flashcards);
          if (!error) flashcardsCount = flashcards.length;
        }
      } catch (e) { console.error("[PROCESS_UPLOAD] Flashcards parse/insert error:", e); }
    }

    // Process Questions
    if (questionsRes.status === "fulfilled" && questionsRes.value.ok) {
      try {
        const data = await questionsRes.value.json();
        const content = data.choices?.[0]?.message?.content || "";
        const parsed = parseAiJson(content);
        const questions = (parsed.questions || [])
          .map((q: any) => ({
            user_id: userId,
            statement: String(q.statement || "").trim(),
            options: Array.isArray(q.options) ? q.options.map(String) : [],
            correct_index: Number(q.correct_index) || 0,
            explanation: String(q.explanation || "").trim(),
            topic: String(q.topic || detectedTopic).trim(),
            source: `upload:${upload.filename}`,
            is_global: true,
            review_status: "pending"
          }))
          .filter((q: any) => q.statement && q.options.length >= 4 && !NON_MEDICAL_CONTENT_REGEX.test(q.statement));
        
        if (questions.length > 0) {
          const { error } = await supabaseAdmin.from("questions_bank").insert(questions);
          if (!error) questionsCount = questions.length;
        }
      } catch (e) { console.error("[PROCESS_UPLOAD] Questions parse/insert error:", e); }
    }

    // Final Step
    await supabaseAdmin.from("uploads").update({
      status: "processed",
      extracted_text: truncatedText,
      extracted_json: {
        flashcards_count: flashcardsCount,
        questions_count: questionsCount,
        suggested_topics: suggestedTopics,
        main_topic: detectedTopic,
        progress: 100,
        step: "done",
      }
    }).eq("id", uploadId);

    // Update RAG document status
    const ragDocId = (upload.extracted_json as any)?.rag_doc_id;
    if (ragDocId) {
      await supabaseAdmin.from("rag_documents").update({
        status: "completed",
        updated_at: new Date().toISOString()
      }).eq("id", ragDocId);
    }

    console.log(`[PROCESS_UPLOAD] Done for ${uploadId}: ${flashcardsCount} FC, ${questionsCount} Q`);

  } catch (err: any) {
    console.error(`[PROCESS_UPLOAD] Background error for ${uploadId}:`, err);
    await supabaseAdmin.from("uploads").update({
      status: "error",
      extracted_json: { 
        error: err.message || "Erro inesperado no processamento.", 
        step: "background_process" 
      }
    }).eq("id", uploadId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log(`[PROCESS_UPLOAD] Request received: ${req.method}`);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { uploadId } = await req.json();
    if (!uploadId) throw new Error("uploadId is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Fetch record with retry
    let upload = null;
    for (let i = 0; i < 3; i++) {
      const { data } = await supabaseAdmin.from("uploads").select("*").eq("id", uploadId).maybeSingle();
      if (data) { upload = data; break; }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!upload) {
      return new Response(JSON.stringify({ error: "Upload record not found" }), { status: 404, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
    const orgId = profile?.organization_id || "00000000-0000-0000-0000-000000000000";

    // Create RAG document tracking
    const { data: ragDoc } = await supabaseAdmin.from("rag_documents").upsert({
      organization_id: orgId,
      uploaded_by: user.id,
      title: upload.filename,
      file_name: upload.filename,
      file_path: upload.storage_path,
      file_type: upload.file_type || "unknown",
      file_size: upload.file_size || 0,
      status: "processing"
    }).select().single();

    await supabaseAdmin.from("uploads").update({
      status: "processing",
      organization_id: orgId,
      extracted_json: { ...upload.extracted_json, step: "starting", progress: 0, rag_doc_id: ragDoc?.id },
    }).eq("id", uploadId);

    // Dispatch background process
    // @ts-ignore
    EdgeRuntime.waitUntil(processInBackground(uploadId, upload, user.id, supabaseAdmin, supabase));

    return new Response(JSON.stringify({
      success: true,
      message: "Processamento iniciado",
      uploadId
    }), { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[PROCESS_UPLOAD] Global error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || "Internal server error",
      step: "initialization"
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
