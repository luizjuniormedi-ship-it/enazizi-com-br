import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";

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
    
    // Basic validation
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

    const page = await document.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: unknown) => (typeof item === "object" && item !== null && "str" in item ? String((item as { str: string }).str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      pages.push(text);
      collectedChars += text.length;
    }
  }

    return pages.join("\n\n").slice(0, maxCharsToCollect);
  } catch (err: any) {
    console.error("[PROCESS_UPLOAD] PDF Extraction error:", err);
    throw new Error(`Falha ao ler PDF: ${err.message}`);
  }
}

async function extractDocxText(fileData: Blob): Promise<string> {
  const { ZipReader, BlobReader, TextWriter } = await import("https://esm.sh/@zip.js/zip.js@2.7.34");
  const zipReader = new ZipReader(new BlobReader(fileData));
  const entries = await zipReader.getEntries();
  const docEntry = entries.find((e: any) => e.filename === "word/document.xml");
  if (!docEntry) return "";
  const xml = await docEntry.getData!(new TextWriter());
  await zipReader.close();
  // Extract text content from XML tags
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
  try {
    // Step 1: Download file
    await updateProgress(supabaseAdmin, uploadId, { step: "downloading", progress: 5 });

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("user-uploads")
      .download(upload.storage_path);

    if (downloadError || !fileData) {
      console.error(`[PROCESS_UPLOAD] Download failed for ${uploadId}:`, downloadError);
      await supabaseAdmin.from("uploads").update({ 
        status: "error", 
        extracted_json: { 
          error: "Falha ao baixar arquivo do storage", 
          details: downloadError?.message,
          step: "download" 
        } 
      }).eq("id", uploadId);
      return;
    }

    const fileSize = fileData.size || (upload.extracted_json as any)?.file_size || 0;
    if (fileSize > MAX_PROCESS_FILE_BYTES) {
      console.warn(`[PROCESS_UPLOAD] File too large: ${fileSize} bytes`);
      await supabaseAdmin.from("uploads").update({ 
        status: "error", 
        extracted_json: { 
          error: "Arquivo muito grande (máx 20MB)",
          size: fileSize,
          step: "validation"
        } 
      }).eq("id", uploadId);
      return;
    }

    // Step 2: Extract text
    await updateProgress(supabaseAdmin, uploadId, { step: "extracting_text", progress: 15 });

    const fileType = (upload.file_type || "").toLowerCase();
    let extractedText = "";

    if (fileType === "txt") {
      extractedText = await fileData.text();
    } else if (fileType === "pdf" || fileType === "application/pdf") {
      extractedText = await extractPdfText(fileData);
    } else if (fileType === "docx" || fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      extractedText = await extractDocxText(fileData);
    } else {
      console.error(`[PROCESS_UPLOAD] Unsupported file type: ${fileType} for upload ${uploadId}`);
      await supabaseAdmin.from("uploads").update({ 
        status: "error", 
        extracted_json: { 
          error: "Formato não suportado", 
          type: fileType,
          step: "extraction" 
        } 
      }).eq("id", uploadId);
      return;
    }

    const truncatedText = extractedText.slice(0, 40000);

    if (!truncatedText.trim()) {
      console.error(`[PROCESS_UPLOAD] No text extracted for upload ${uploadId}`);
      await supabaseAdmin.from("uploads").update({ 
        status: "error", 
        extracted_text: "Sem texto extraído.", 
        extracted_json: { 
          error: "Não foi possível extrair texto deste arquivo. Ele pode estar protegido ou ser uma imagem digitalizada sem OCR.", 
          step: "extraction" 
        } 
      }).eq("id", uploadId);
      return;
    }

    await supabaseAdmin.from("uploads").update({ extracted_text: truncatedText }).eq("id", uploadId);

    // Step 3: Validate medical content
    await updateProgress(supabaseAdmin, uploadId, { step: "validating", progress: 25 });

    let validationResponse;
    try {
      validationResponse = await aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Analise o texto e determine se é relacionado a medicina/saúde CLÍNICA. Editais, regulamentos de processo seletivo, cronogramas, requisitos de inscrição e documentos administrativos NÃO são conteúdo médico. Responda APENAS com JSON: {"is_medicine": true/false, "reason": "breve explicação", "main_topic": "especialidade médica principal"}`
          },
          { role: "user", content: `Classifique:\n\n${truncatedText.slice(0, 3000)}` }
        ],
      });
    } catch (aiErr) {
      console.error("[PROCESS_UPLOAD] AI Validation fetch failed:", aiErr);
      // Fallback: assume it's medical if extraction worked, to avoid blocking user
      validationResponse = { ok: false }; 
    }

    let detectedTopic = "Clínica Médica";

    if (validationResponse.ok) {
      const valData = await validationResponse.json();
      const valContent = sanitizeAiContent(valData.choices?.[0]?.message?.content || "");
      try {
        const cleaned = valContent.replace(/```json\n?/g, "").replace(/```/g, "").trim();
        const validation = JSON.parse(cleaned);
        if (!validation.is_medicine) {
          await supabaseAdmin.from("uploads").delete().eq("id", uploadId);
          await supabaseAdmin.storage.from("user-uploads").remove([upload.storage_path]);
          return;
        }
        if (validation.main_topic) detectedTopic = validation.main_topic;
      } catch {}
    }

    // Infer topic from filename
    const fn = upload.filename.toLowerCase();
    if (fn.includes("car") || fn.includes("cardio")) detectedTopic = "Cardiologia";
    else if (fn.includes("ped")) detectedTopic = "Pediatria";
    else if (fn.includes("cir")) detectedTopic = "Cirurgia";
    else if (fn.includes("go") || fn.includes("ginec") || fn.includes("obst")) detectedTopic = "Ginecologia e Obstetrícia";
    else if (fn.includes("prev") || fn.includes("mps")) detectedTopic = "Medicina Preventiva";
    else if (fn.includes("neuro")) detectedTopic = "Neurologia";
    else if (fn.includes("pneumo")) detectedTopic = "Pneumologia";
    else if (fn.includes("nefro")) detectedTopic = "Nefrologia";
    else if (fn.includes("infecto")) detectedTopic = "Infectologia";

    let flashcardsCount = 0;
    let questionsCount = 0;
    let suggestedTopics: any[] = [];

    // Step 4: Generate Suggested Topics (Planner Integration)
    await updateProgress(supabaseAdmin, uploadId, { step: "analyzing_topics", progress: 35, main_topic: detectedTopic });
    
    try {
      const topicResponse = await aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Analise o conteúdo médico e sugira uma lista de tópicos de estudo. 
            Cada tópico deve ter: tema, especialidade, dificuldade (facil/medio/dificil), subtopico.
            Gere entre 3 e 8 tópicos principais.
            Responda APENAS com JSON: {"topics": [{"tema": "...", "especialidade": "...", "dificuldade": "...", "subtopico": "..."}]}`
          },
          { role: "user", content: `Sugira tópicos para o cronograma baseados neste texto (Tema Principal: ${detectedTopic}):\n\n${truncatedText.slice(0, 8000)}` }
        ],
      });

      if (topicResponse.ok) {
        const topicData = await topicResponse.json();
        const content = sanitizeAiContent(topicData.choices?.[0]?.message?.content || "");
        console.log("[PROCESS_UPLOAD] AI Topic Raw Content:", content);
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
          suggestedTopics = JSON.parse(cleaned).topics || [];
        } catch (e) {
          console.error("[PROCESS_UPLOAD] AI Topic Parse Error:", e, "Content:", content);
        }
      } else {
        const errText = await topicResponse.text();
        console.error("[PROCESS_UPLOAD] AI Topic Fetch Failed:", topicResponse.status, errText);
      }
    } catch (e) {
      console.error("Topic suggestion error:", e);
    }

    // Step 5: Generate flashcards
    await updateProgress(supabaseAdmin, uploadId, { step: "generating_flashcards", progress: 40, main_topic: detectedTopic });

    try {
      const aiResponse = await aiFetch({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Crie flashcards educativos para Residência Médica a partir do texto.
Cada flashcard: question, answer, topic.
Gere 5-15 flashcards relevantes.
Responda APENAS com JSON: {"flashcards": [{"question": "...", "answer": "...", "topic": "..."}]}`
          },
          { role: "user", content: `Gere flashcards:\n\n${truncatedText.slice(0, 10000)}` }
        ],
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        let flashcards: Array<{ question: string; answer: string; topic: string }> = [];
        const content = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
          flashcards = JSON.parse(cleaned).flashcards || [];
        } catch {}

        const finalFlashcards = flashcards
          .map((fc) => ({ question: String(fc.question || "").trim(), answer: String(fc.answer || "").trim(), topic: String(fc.topic || detectedTopic).trim() }))
          .filter((fc) => fc.question && fc.answer)
          .filter((fc) => !NON_MEDICAL_CONTENT_REGEX.test(`${fc.topic} ${fc.question} ${fc.answer}`));

        if (finalFlashcards.length > 0) {
          await supabaseAdmin.from("flashcards").insert(
            finalFlashcards.map((fc) => ({ user_id: userId, question: fc.question, answer: fc.answer, topic: fc.topic, is_global: true }))
          );
          flashcardsCount = finalFlashcards.length;
        }
      }
    } catch (e) {
      console.error("Flashcard generation error:", e);
    }

    // Step 5: Generate questions (parallel)
    await updateProgress(supabaseAdmin, uploadId, { step: "generating_questions", progress: 60, flashcards_count: flashcardsCount, main_topic: detectedTopic });

    try {
      const chunkSize = 12000;
      const chunks: string[] = [];
      for (let i = 0; i < truncatedText.length; i += chunkSize) {
        chunks.push(truncatedText.slice(i, i + chunkSize));
      }
      const chunksToProcess = chunks.slice(0, 3);

      const processChunk = async (chunk: string) => {
        const response = await aiFetch({
          model: "openai/gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `Extraia questões de múltipla escolha do texto fornecido. Se o texto já contiver questões formatadas, converta-as para o formato JSON. Se for conteúdo teórico, gere questões baseadas no conteúdo.
IMPORTANTE: Gere o MÁXIMO de questões possível (10-20 por chunk). EXATAMENTE 5 alternativas (A-E) por questão. NUNCA gere questões que referenciem imagens, figuras, fotos ou gráficos externos.
Formato JSON PURO (sem markdown): 
{"questions": [{"statement": "enunciado completo com caso clínico", "options": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "correct_index": 0, "explanation": "explicação detalhada", "topic": "especialidade médica"}]}
Se não encontrar questões válidas, retorne {"questions": []}`
            },
            { role: "user", content: `Tema principal: ${detectedTopic}\n\nTexto:\n${chunk}` }
          ],
        });
        if (!response.ok) return [];
        const data = await response.json();
        const content = sanitizeAiContent(data.choices?.[0]?.message?.content || "");
        const results: Array<{ statement: string; options: string[]; correct_index: number; explanation: string; topic: string }> = [];
        try {
          const cleaned = content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            for (const q of (parsed.questions || [])) {
              if (q.statement && Array.isArray(q.options) && q.options.length >= 4 && q.options.length <= 5 && typeof q.correct_index === "number" && String(q.statement).trim().length >= 120 && !NON_MEDICAL_CONTENT_REGEX.test(q.statement) && !/\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo)\b/i.test(q.statement)) {
                results.push({ statement: String(q.statement).trim(), options: q.options.map(String), correct_index: q.correct_index, explanation: String(q.explanation || "").trim(), topic: String(q.topic || detectedTopic).trim() });
              }
            }
          }
        } catch {}
        return results;
      };

      const chunkResults = await Promise.allSettled(chunksToProcess.map((c) => processChunk(c)));
      const allQuestions: typeof chunksToProcess extends any[] ? ReturnType<typeof processChunk> extends Promise<infer T> ? T : never : never = [];
      for (const r of chunkResults) {
        if (r.status === "fulfilled") (allQuestions as any[]).push(...r.value);
      }

      if ((allQuestions as any[]).length > 0) {
        const rows = (allQuestions as any[]).map((q: any) => ({
          user_id: userId, statement: q.statement, options: q.options, correct_index: q.correct_index,
          explanation: q.explanation, topic: q.topic, source: `upload:${upload.filename}`, is_global: true, review_status: "pending",
        }));
        for (let i = 0; i < rows.length; i += 50) {
          const batch = rows.slice(i, i + 50);
          const { error } = await supabaseAdmin.from("questions_bank").insert(batch);
          if (!error) questionsCount += batch.length;
          else console.error("Question insert error:", error);
        }
      }
    } catch (e) {
      console.error("Question generation error:", e);
    }

    // Step 7: Done
    await supabaseAdmin.from("uploads").update({
      status: "processed",
      extracted_json: {
        flashcards_count: flashcardsCount,
        questions_count: questionsCount,
        suggested_topics: suggestedTopics,
        topics: [detectedTopic],
        main_topic: detectedTopic,
        progress: 100,
        step: "done",
      }
    }).eq("id", uploadId);

    // 5. Atualizar rag_documents
    await supabaseAdmin.from("rag_documents").update({
      status: "completed",
      updated_at: new Date().toISOString()
    }).eq("id", (upload.extracted_json as any)?.rag_doc_id);

    console.log(`Background processing done for ${uploadId}: ${flashcardsCount} flashcards, ${questionsCount} questions, ${suggestedTopics.length} suggested topics`);

  } catch (e) {
    console.error("Background processing error:", e);
    await supabaseAdmin.from("uploads").update({
      status: "error",
      extracted_json: { error: e instanceof Error ? e.message : "Erro no processamento", step: "error" },
    }).eq("id", uploadId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
    const userId = user.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { uploadId } = await req.json();
    if (!uploadId) throw new Error("uploadId is required");

    // Retry select to handle potential replication lag
    let upload = null;
    for (let i = 0; i < 3; i++) {
      const { data } = await supabaseAdmin
        .from("uploads")
        .select("*")
        .eq("id", uploadId)
        .maybeSingle();
      if (data) {
        upload = data;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!upload) {
      console.error("[PROCESS_UPLOAD] Upload record not found after retries:", uploadId);
      return new Response(JSON.stringify({ error: "Upload not found" }), { status: 404, headers: corsHeaders });
    }

    // 1. Vincular organization_id do perfil do usuário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();

    // 2. Criar ou atualizar registro em rag_documents para rastreabilidade RAG
    const { data: ragDoc } = await supabaseAdmin.from("rag_documents").upsert({
      organization_id: profile?.organization_id || "00000000-0000-0000-0000-000000000000",
      uploaded_by: userId,
      title: upload.filename,
      file_name: upload.filename,
      file_path: upload.storage_path,
      file_type: upload.file_type || "unknown",
      file_size: upload.file_size || 0,
      status: "processing"
    }).select().single();

    // 3. Atualizar status na tabela uploads
    await supabaseAdmin.from("uploads").update({
      status: "processing",
      organization_id: profile?.organization_id,
      extracted_json: { step: "starting", progress: 0, rag_doc_id: ragDoc?.id },
    }).eq("id", uploadId);

    // 4. Process - we await to ensure completion in this context
    await processInBackground(uploadId, upload, userId, supabaseAdmin, supabase);

    // Return immediately — frontend will poll for progress
    return new Response(JSON.stringify({
      message: "Processamento iniciado em background",
      status: "processing",
      uploadId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("process-upload error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
