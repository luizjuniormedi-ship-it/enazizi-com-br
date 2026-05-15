import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";
import { aiFetch, sanitizeAiContent, parseAiJson } from "../_shared/ai-fetch.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { sanitizeForPostgres } from "../_shared/db-utils.ts";
import { logPipelineAlert } from "../_shared/pipeline-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_PAGES_TO_PARSE = 120;

async function extractPdfText(fileData: Blob): Promise<string> {
  const data = new Uint8Array(await fileData.arrayBuffer());
  const document = await getDocument({ data, useSystemFonts: true }).promise;
  const totalPages = Math.min(document.numPages, MAX_PDF_PAGES_TO_PARSE);
  const pages: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
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

async function processTextToContent(
  fullText: string,
  topic: string,
  source: string,
  userId: string,
  supabaseAdmin: any,
  uploadId?: string,
  existingJson?: Record<string, any>,
): Promise<{ questions: number; flashcards: number }> {
  const chunkSize = 12000; // Slightly smaller chunks for better reliability
  const chunks: string[] = [];
  for (let i = 0; i < fullText.length; i += chunkSize) {
    chunks.push(fullText.slice(i, i + chunkSize));
  }

  const chunksToProcess = chunks.slice(0, 15); // Process up to 15 chunks
  const baseJson = existingJson || {};

  const updateProgress = async (chunksDone: number, qFound: number, fFound: number) => {
    if (!uploadId) return;
    const progress = Math.round(20 + (chunksDone / chunksToProcess.length) * 70);
    const currentQ = (baseJson.questions_count || 0) + qFound;
    const currentF = (baseJson.flashcards_count || 0) + fFound;
    
    await supabaseAdmin.from("uploads").update({
      extracted_json: {
        ...baseJson,
        step: "populating_content",
        progress,
        chunks_total: chunksToProcess.length,
        chunks_done: chunksDone,
        questions_count: currentQ,
        flashcards_count: currentF,
        main_topic: topic,
      },
    }).eq("id", uploadId);
  };

  await updateProgress(0, 0, 0);

  const processChunk = async (chunk: string): Promise<{ q: number; f: number }> => {
    console.log(`[Populate] Processing chunk of size ${chunk.length}...`);
    try {
      const response = await aiFetch({
        model: AI_MODELS.generation,
        messages: [
          {
            role: "system",
            content: `Você é um especialista em educação médica. Sua tarefa é extrair e gerar questões e flashcards a partir do texto fornecido.
            
            1. QUESTÕES: Extraia questões existentes ou gere novas (caso clínico 450+ chars, 4 alternativas A-D, gabarito e explicação).
            2. FLASHCARDS: Gere flashcards (Frente/Pergunta com caso clínico curto, Verso/Resposta concisa, Explicação).
            
            IDIOMA: TUDO em PORTUGUÊS BRASILEIRO (pt-BR).
            GERE: 5-10 questões e 5-10 flashcards por bloco.
            
            JSON format: 
            {
              "questions": [{"statement": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_index": 0, "explanation": "...", "topic": "..."}],
              "flashcards": [{"question": "🏥 CASO... ❓ PERGUNTA...", "answer": "...", "explanation": "...", "topic": "..."}]
            }`
          },
          { role: "user", content: `Tema: ${topic}\n\nTexto:\n${chunk}` }
        ],
        timeoutMs: 120000, // 2 minutes for content generation
      });

      if (!response.ok) throw new Error(`AI error ${response.status}`);

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
      const parsed = parseAiJson(content);
      
      let qCount = 0;
      let fCount = 0;

      // Filter and insert questions
      if (parsed.questions && Array.isArray(parsed.questions)) {
        const questions = parsed.questions.filter((q: any) => 
          q.statement && Array.isArray(q.options) && q.options.length >= 4
        ).map((q: any) => sanitizeForPostgres({
          user_id: userId,
          statement: String(q.statement).trim(),
          options: q.options.map(String),
          correct_index: q.correct_index,
          explanation: String(q.explanation || "").trim(),
          topic: String(q.topic || topic).trim(),
          source,
          is_global: true,
          review_status: "pending"
        }));

        if (questions.length > 0) {
          const { error } = await supabaseAdmin.from("questions_bank").insert(questions);
          if (!error) qCount = questions.length;
        }
      }

      // Filter and insert flashcards
      if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
        const flashcards = parsed.flashcards.filter((f: any) => 
          f.question && f.answer
        ).map((f: any) => sanitizeForPostgres({
          user_id: userId,
          question: String(f.question).trim(),
          answer: String(f.answer).trim(),
          explanation: String(f.explanation || "").trim(),
          topic: String(f.topic || topic).trim(),
          source,
          is_global: true,
          generation_method: "upload_extraction"
        }));

        if (flashcards.length > 0) {
          const { error } = await supabaseAdmin.from("flashcards").insert(flashcards);
          if (!error) fCount = flashcards.length;
        }
      }

      return { q: qCount, f: fCount };
    } catch (err) {
      console.error("[Populate] Chunk error:", err);
      await logPipelineAlert({
        source: "populate-questions",
        message: `Error processing chunk: ${err instanceof Error ? err.message : String(err)}`,
        alert_type: "chunk_processing_error",
        severity: "error",
        payload: { uploadId, topic }
      });
      return { q: 0, f: 0 };
    }
  };

  // Process in serial or small batches to avoid flooding/timeouts
  let totalQ = 0;
  let totalF = 0;
  for (let i = 0; i < chunksToProcess.length; i++) {
    const res = await processChunk(chunksToProcess[i]);
    totalQ += res.q;
    totalF += res.f;
    await updateProgress(i + 1, totalQ, totalF);
  }

  return { questions: totalQ, flashcards: totalF };
}

async function populateInBackground(
  uploadId: string,
  upload: any,
  userId: string,
  supabaseAdmin: any,
) {
  try {
    const existingJson = (upload.extracted_json || {}) as Record<string, any>;
    await supabaseAdmin.from("uploads").update({
      extracted_json: { ...existingJson, step: "populating_content", progress: 10 },
    }).eq("id", uploadId);

    let fullText = "";
    if (upload.extracted_text && upload.extracted_text.trim().length > 100) {
      fullText = upload.extracted_text;
    } else if (upload.storage_path) {
      const { data: fileData } = await supabaseAdmin.storage.from("user-uploads").download(upload.storage_path);
      if (fileData) {
        const fileType = (upload.file_type || "").toLowerCase();
        fullText = fileType === "txt" ? await fileData.text() : await extractPdfText(fileData);
        await supabaseAdmin.from("uploads").update({ extracted_text: fullText.slice(0, 50000) }).eq("id", uploadId);
      }
    }

    if (!fullText.trim()) {
      throw new Error("Não foi possível extrair texto do arquivo.");
    }

    const topic = existingJson.main_topic || "Clínica Médica";
    const totals = await processTextToContent(fullText, topic, `upload:${upload.filename}`, userId, supabaseAdmin, uploadId, existingJson);

    const finalStatus = (totals.questions > 0 || totals.flashcards > 0) ? "processed" : "done";
    const finalError = (totals.questions === 0 && totals.flashcards === 0) ? "Nenhuma questão ou flashcard foi gerado (verifique o conteúdo do arquivo)." : undefined;

    await supabaseAdmin.from("uploads").update({
      status: finalStatus,
      extracted_json: {
        ...existingJson,
        questions_count: (existingJson.questions_count || 0) + totals.questions,
        flashcards_count: (existingJson.flashcards_count || 0) + totals.flashcards,
        step: "done",
        progress: 100,
        error: finalError,
        repopulated_at: new Date().toISOString()
      }
    }).eq("id", uploadId);

  } catch (err: any) {
    console.error("[Populate] Background error:", err);
    await supabaseAdmin.from("uploads").update({
      extracted_json: { ...(upload.extracted_json || {}), step: "error", error: err.message }
    }).eq("id", uploadId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");

    let userId: string;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (user) {
      userId = user.id;
    } else {
      // Fallback for service role calls
      const { data: adminRole } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
      userId = adminRole?.user_id || "00000000-0000-0000-0000-000000000000";
    }

    const { uploadId } = await req.json();
    if (!uploadId) throw new Error("uploadId required");

    const { data: upload } = await supabaseAdmin.from("uploads").select("*").eq("id", uploadId).maybeSingle();
    if (!upload) throw new Error("Upload not found");

    populateInBackground(uploadId, upload, userId, supabaseAdmin).catch(console.error);

    return new Response(JSON.stringify({ success: true, message: "Geração iniciada" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});