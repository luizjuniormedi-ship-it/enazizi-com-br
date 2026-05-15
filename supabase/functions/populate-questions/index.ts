import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";

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

async function processTextToQuestions(
  fullText: string,
  topic: string,
  source: string,
  userId: string,
  supabaseAdmin: any,
  uploadId?: string,
  existingJson?: Record<string, any>,
): Promise<number> {
  const chunkSize = 15000;
  const chunks: string[] = [];
  for (let i = 0; i < fullText.length; i += chunkSize) {
    chunks.push(fullText.slice(i, i + chunkSize));
  }

  const chunksToProcess = chunks.slice(0, 10); // Process up to 10 chunks instead of 4
  const baseJson = existingJson || {};

  // Update progress if uploadId provided
  const updateProgress = async (chunksDone: number, questionsFound: number) => {
    if (!uploadId) return;
    const progress = Math.round(20 + (chunksDone / chunksToProcess.length) * 70);
    await supabaseAdmin.from("uploads").update({
      extracted_json: {
        ...baseJson,
        step: "populating_questions",
        progress,
        chunks_total: chunksToProcess.length,
        chunks_done: chunksDone,
        questions_count: (baseJson.questions_count || 0) + questionsFound,
        main_topic: topic,
      },
    }).eq("id", uploadId);
  };

  await updateProgress(0, 0);

  const processChunk = async (chunk: string): Promise<number> => {
    const response = await aiFetch({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extraia TODAS as questões de múltipla escolha do texto. Se encontrar questões já formatadas, converta para JSON preservando EXATAMENTE o enunciado e alternativas originais. Se for texto teórico, gere questões baseadas no conteúdo.

IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). Se o texto original estiver em inglês, TRADUZA para português. NUNCA retorne questões em inglês.

GERE O MÁXIMO POSSÍVEL (10-30 por bloco).

IMPORTANTE: Para questões que já existem no texto com gabarito/comentário, use o correct_index correto baseado no gabarito fornecido. Se não houver gabarito, use seu conhecimento médico para determinar a resposta correta.

OBRIGATÓRIO: Exatamente 4 alternativas (A-D) por questão. NUNCA gere questões que referenciem imagens, figuras, fotos, radiografias ou gráficos externos.
Mínimo 450 caracteres por enunciado clínico.

Formato JSON PURO: {"questions": [{"statement": "enunciado clínico completo (450+ chars)", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_index": 0, "explanation": "explicação detalhada do raciocínio clínico", "topic": "especialidade médica"}]}
Se não encontrar questões, retorne {"questions": []}`
        },
        { role: "user", content: `Tema: ${topic}\n\n${chunk}` }
      ],
    });

    console.log("AI response status:", response.status);
    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", errText);
      return 0;
    }

    const data = await response.json();
    const rawContent = sanitizeAiContent(data.choices?.[0]?.message?.content || "");
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```/g, "").trim();

    let parsed: any = null;
    try { parsed = JSON.parse(cleaned); } catch {
      try {
        const jsonMatch = cleaned.match(/\{"questions"\s*:\s*\[[\s\S]*?\]\s*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        try {
          const arrMatch = cleaned.match(/\[[\s\S]*\]/);
          if (arrMatch) parsed = { questions: JSON.parse(arrMatch[0]) };
        } catch { return 0; }
      }
    }

    if (!parsed) return 0;

    const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female)\b/i;
    const IMAGE_REF_PATTERN = /\b(imagem abaixo|figura abaixo|observe a imagem|na imagem|na figura|texto abaixo|radiografia abaixo|fotografia|ECG abaixo|tomografia abaixo|observe o gráfico|observe a figura|observe a foto|imagem a seguir|figura a seguir)\b/i;
    const questions = (parsed.questions || []).filter((q: any) =>
      q.statement && Array.isArray(q.options) && q.options.length >= 4 && typeof q.correct_index === "number" &&
      String(q.statement).trim().length >= 100 && // Lower threshold to capture more real questions
      !ENGLISH_PATTERN.test(q.statement) && !IMAGE_REF_PATTERN.test(q.statement)
    );

    if (questions.length > 0) {
      const rows = questions.map((q: any) => {
        const stmtLen = String(q.statement).trim().length;
        return {
          user_id: userId, statement: String(q.statement).trim(), options: q.options.map(String),
          correct_index: q.correct_index, explanation: String(q.explanation || "").trim(),
          topic: String(q.topic || topic).trim(), source, is_global: true, review_status: "pending",
          quality_tier: stmtLen >= 450 ? "exam_standard" : (stmtLen >= 250 ? "basic" : "needs_upgrade"),
        };
      });
      const { error } = await supabaseAdmin.from("questions_bank").insert(rows);
      if (!error) return rows.length;
      else { console.error("Insert error:", error); return 0; }
    }
    return 0;
  };

  // Process in parallel
  const results = await Promise.allSettled(chunksToProcess.map((c) => processChunk(c)));

  let totalQuestions = 0;
  let chunksDone = 0;
  for (const r of results) {
    chunksDone++;
    if (r.status === "fulfilled") totalQuestions += r.value;
  }
  await updateProgress(chunksDone, totalQuestions);

  return totalQuestions;
}

async function populateInBackground(
  uploadId: string,
  upload: any,
  userId: string,
  supabaseAdmin: any,
) {
  try {
    await supabaseAdmin.from("uploads").update({
      extracted_json: { ...(upload.extracted_json || {}), step: "populating_questions", progress: 10 },
    }).eq("id", uploadId);

    let fullText = "";
    if (upload.extracted_text && upload.extracted_text.trim().length > 100) {
      fullText = upload.extracted_text;
    } else if (upload.storage_path) {
      const { data: fileData } = await supabaseAdmin.storage.from("user-uploads").download(upload.storage_path);
      if (!fileData) {
        await supabaseAdmin.from("uploads").update({ extracted_json: { ...(upload.extracted_json || {}), step: "error", error: "File not found" } }).eq("id", uploadId);
        return;
      }
      const fileType = (upload.file_type || "").toLowerCase();
      fullText = fileType === "txt" ? await fileData.text() : await extractPdfText(fileData);
      await supabaseAdmin.from("uploads").update({ extracted_text: fullText.slice(0, 50000) }).eq("id", uploadId);
    }

    if (!fullText.trim()) {
      await supabaseAdmin.from("uploads").update({ extracted_json: { ...(upload.extracted_json || {}), step: "error", error: "No text" } }).eq("id", uploadId);
      return;
    }

    const fn = upload.filename.toLowerCase();
    let topic = "Clínica Médica";
    if (fn.includes("car") || fn.includes("cardio")) topic = "Cardiologia";
    else if (fn.includes("ped")) topic = "Pediatria";
    else if (fn.includes("cir")) topic = "Cirurgia";
    else if (fn.includes("go") || fn.includes("ginec")) topic = "Ginecologia e Obstetrícia";
    else if (fn.includes("prev")) topic = "Medicina Preventiva";
    else if (fn.includes("neuro")) topic = "Neurologia";
    else if (fn.includes("pneumo")) topic = "Pneumologia";

    const existingJson = (upload.extracted_json || {}) as Record<string, any>;
    const totalQuestions = await processTextToQuestions(fullText, topic, `upload:${upload.filename}`, userId, supabaseAdmin, uploadId, existingJson);

    await supabaseAdmin.from("uploads").update({
      extracted_json: {
        ...existingJson,
        questions_count: (existingJson.questions_count || 0) + totalQuestions,
        main_topic: topic,
        repopulated_at: new Date().toISOString(),
        step: "done",
        progress: 100,
      },
    }).eq("id", uploadId);

    console.log(`Populate done for ${uploadId}: ${totalQuestions} questions`);
  } catch (e) {
    console.error("Populate background error:", e);
    await supabaseAdmin.from("uploads").update({
      extracted_json: { ...(upload.extracted_json || {}), step: "error", error: e instanceof Error ? e.message : "Erro" },
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

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let userId: string;

    if (token === serviceRoleKey) {
      const { data: adminRole } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
      userId = adminRole?.user_id || "92736dea-6422-48ff-8330-de9f0d1094e9";
    } else {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
      if (claimsError || !claimsData?.user) return new Response(JSON.stringify({ error: "Token inválido. Faça login novamente." }), { status: 401, headers: corsHeaders });

      const uid = claimsData.user.id;
      const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      if (!roleData) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
      userId = uid;
    }

    const body = await req.json();

    // Mode 1: Raw text input (synchronous — used for batch/zip imports)
    if (body.text && body.source) {
      const topic = body.topic || "Clínica Médica";
      const totalQuestions = await processTextToQuestions(body.text.slice(0, 80000), topic, body.source, userId, supabaseAdmin);
      return new Response(JSON.stringify({
        message: `${totalQuestions} questões extraídas de ${body.source}`,
        questions_count: totalQuestions, topic,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mode 2: Upload-based (background processing)
    const { uploadId } = body;
    if (!uploadId) {
      return new Response(JSON.stringify({ error: "uploadId or text+source required" }), { status: 400, headers: corsHeaders });
    }

    const { data: upload } = await supabaseAdmin.from("uploads").select("*").eq("id", uploadId).maybeSingle();
    if (!upload) {
      return new Response(JSON.stringify({ error: "Upload not found" }), { status: 404, headers: corsHeaders });
    }

    // Fire-and-forget background processing
    populateInBackground(uploadId, upload, userId, supabaseAdmin).catch((e) => {
      console.error("Populate background task failed:", e);
    });

    return new Response(JSON.stringify({
      message: "Geração de questões iniciada em background",
      status: "processing",
      uploadId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("populate-questions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
