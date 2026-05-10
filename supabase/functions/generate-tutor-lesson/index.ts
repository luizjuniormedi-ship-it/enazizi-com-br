import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/require-auth.ts";
import { aiFetch, getAiErrorMessage, parseAiJson } from "../_shared/ai-fetch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestId = crypto.randomUUID();
  console.log(`[generate-tutor-lesson] [LESSON_START] STARTED id=${requestId}`);

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) {
      console.error(`[generate-tutor-lesson] [AUTH_FAILED] id=${requestId}`);
      return auth.response;
    }
    const { userId } = auth;

    const body = await req.json();
    const { sessionId, conversationId, topic, lessonType = "aula_completa", cmeEnabled = false, customContent } = body;
    console.log(`[generate-tutor-lesson] [LESSON_PAYLOAD] id=${requestId}`, { userId, sessionId, conversationId, topic, cmeEnabled, customContentLength: customContent?.length });

    if (!sessionId && !conversationId && !topic && !customContent) {
      return json({ error: "missing_params", message: "É necessário fornecer sessionId, conversationId, topic ou customContent." }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch Messages - Flexible fallback logic
    let messages: any[] = [];
    let sourceTable = "none";

    const fetchStrategies = [
      { table: "tutor_messages", col: "tutor_session_id", val: sessionId },
      { table: "tutor_messages", col: "conversation_id", val: conversationId },
      { table: "chat_messages", col: "conversation_id", val: conversationId },
      { table: "chat_messages", col: "session_id", val: sessionId },
    ];

    for (const strategy of fetchStrategies) {
      if (!strategy.val) continue;
      console.log(`[generate-tutor-lesson] [LESSON_FETCH_TRY] id=${requestId} table=${strategy.table} col=${strategy.col} val=${strategy.val}`);
      const { data } = await supabase
        .from(strategy.table)
        .select("role, content")
        .eq(strategy.col, strategy.val)
        .order("created_at", { ascending: true });
      
      if (data && data.length > 0) {
        messages = data;
        sourceTable = strategy.table;
        console.log(`[generate-tutor-lesson] [LESSON_MESSAGES] id=${requestId} FOUND count=${messages.length} table=${sourceTable}`);
        break;
      }
    }

    // fallback: buscar mensagens recentes do usuário se nada for encontrado por ID
    if (messages.length === 0) {
      console.log(`[generate-tutor-lesson] [LESSON_FETCH_FALLBACK] id=${requestId} user_id=${userId}`);
      const { data: recentTutor } = await supabase.from("tutor_messages").select("role, content").eq("user_id", userId).order("created_at", { descending: true }).limit(10);
      const { data: recentChat } = await supabase.from("chat_messages").select("role, content").eq("user_id", userId).order("created_at", { descending: true }).limit(10);
      
      if (recentTutor && recentTutor.length > 0) {
        messages = recentTutor.reverse();
        sourceTable = "tutor_messages_recent";
      } else if (recentChat && recentChat.length > 0) {
        messages = recentChat.reverse();
        sourceTable = "chat_messages_recent";
      }
    }

    if (messages.length === 0 && !topic && !customContent) {
      console.error(`[generate-tutor-lesson] [LESSON_MESSAGES] id=${requestId} FAILED count=0`);
      return json({ error: "no_messages", message: "Não encontramos mensagens suficientes para montar a aula." }, 400);
    }

    let historyText = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n");
    if (customContent) {
      historyText = `[CONTEXTO ADICIONAL]: ${customContent}\n\n` + historyText;
    }

    // 2. Call AI to Generate Structured Lesson
    const systemPrompt = `Você é um Tutor Médico especialista em pedagogia clínica. 
Sua tarefa é gerar uma aula estruturada e didática baseada no histórico de conversa fornecido ou no tema solicitado.
A aula deve ser dividida em seções claras: Introdução, Explicação Técnica, Aplicação Clínica (Casos) e Resumo.

Responda APENAS com um objeto JSON válido seguindo este formato:
{
  "title": "Título da Aula",
  "objectives": ["objetivo 1", "objetivo 2"],
  "sections": [
    {
      "title": "Nome da Seção",
      "explanation": "Conteúdo detalhado em Markdown",
      "clinicalApplication": "Como isso aparece na prática médica",
      "keyPoints": ["ponto importante 1", "ponto importante 2"],
      "questions": ["pergunta de reflexão 1"]
    }
  ],
  "summary": "Resumo final",
  "nextSteps": ["próximo tema sugerido"]
}`;

    const userPrompt = `Gerar aula do tipo "${lessonType}" sobre o tema: "${topic || 'Histórico fornecido'}".\n\nHistórico:\n${historyText}`;

    console.log(`[generate-tutor-lesson] [LESSON_AI_START] id=${requestId}`);
    const aiResponse = await aiFetch({
      model: "openai/gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    });

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices[0].message.content;
    console.log(`[generate-tutor-lesson] [LESSON_AI_DONE] id=${requestId} length=${rawContent?.length}`);
    const lessonContent = parseAiJson(rawContent);

    // 3. Save to tutor_lessons
    console.log(`[generate-tutor-lesson] [LESSON_SAVE_START] id=${requestId}`);
    const { data: lesson, error: insError } = await supabase
      .from("tutor_lessons")
      .insert({
        user_id: userId,
        session_id: sessionId || null,
        conversation_id: conversationId || null,
        title: lessonContent.title,
        lesson_type: lessonType,
        content: lessonContent,
        source_message_count: messages.length,
        generation_status: 'completed'
      })
      .select()
      .single();

    if (insError) {
      console.error(`[generate-tutor-lesson] [LESSON_SAVE_FAILED] id=${requestId}`, insError);
      throw insError;
    }
    console.log(`[generate-tutor-lesson] [LESSON_SAVE_DONE] id=${requestId} lessonId=${lesson.id}`);

    // 4. Trigger CME if enabled
    let cmeStatus = "not_requested";
    let pipelineId = null;

    if (cmeEnabled) {
      try {
        console.log(`[generate-tutor-lesson] [CME_START] id=${requestId} lessonId=${lesson.id}`);
        const cmeResp = await supabase.functions.invoke("cme-start-pipeline", {
          body: { 
            lessonId: lesson.id,
            title: lesson.title,
            topic: topic || lesson.title,
            content: lessonContent,
            isFullSession: true
          }
        });
        
        console.log(`[generate-tutor-lesson] [CME_DONE] id=${requestId} status=${cmeResp.data?.status} pipelineId=${cmeResp.data?.pipelineId}`);
        
        if (cmeResp.data?.pipelineId) {
          pipelineId = cmeResp.data.pipelineId;
          cmeStatus = "queued";
          await supabase.from("tutor_lessons").update({ 
            cme_pipeline_id: pipelineId,
            cme_status: cmeStatus
          }).eq('id', lesson.id);
        } else if (cmeResp.data?.status === 'queued') {
          cmeStatus = "queued";
          pipelineId = cmeResp.data.pipelineId || cmeResp.data.id;
        }
      } catch (cmeErr) {
        console.error(`[generate-tutor-lesson] [CME_FAILED] id=${requestId}`, cmeErr);
        cmeStatus = "failed";
      }
    }

    console.log(`[generate-tutor-lesson] [LESSON_COMPLETED] id=${requestId} lessonId=${lesson.id}`);
    return json({
      success: true,
      lessonId: lesson.id,
      lesson: lessonContent,
      cme: {
        requested: cmeEnabled,
        status: cmeStatus,
        pipelineId
      }
    });

  } catch (error) {
    console.error(`[generate-tutor-lesson] FAILED id=${requestId}`, error);
    return json({ 
      error: "generation_failed", 
      message: "A aula textual foi criada, mas a renderização cinematográfica não está disponível agora.",
      technical_reason: error.message
    }, 500);
  }
});
