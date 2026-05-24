import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";

/**
 * TUTOR V3 PREMIUM — ENTERPRISE HARDENING
 * Longitudinal Pedagogical Engine with Resilient Persistence
 */
Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId, userId } = correlation;

  try {
    if (!userId) throw new Error("UNAUTHORIZED: Authentication required");

    const body = await req.json().catch(() => ({}));
    const { message, sessionId, currentBlock: bodyBlock, newTopic, pedagogicalContext: bodyPedContext } = body;

    // 1. SESSION ORCHESTRATION (Resilient)
    let session = null;
    let sessionTopic = newTopic || bodyPedContext?.topic;
    
    if (sessionId) {
      const { data, error } = await supabaseAdmin
        .from("tutor_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      
      if (error) logger.error("SESSION_FETCH_ERROR", error.message);
      session = data;
      if (data?.topic && !sessionTopic) sessionTopic = data.topic;
    }

    // 2. LONGITUDINAL MEMORY HYDRATION
    let longitudinalContext = "";
    if (userId && sessionTopic) {
      const { data: memory, error: memError } = await supabaseAdmin
        .from("tutor_learning_memory")
        .select("*")
        .eq("user_id", userId)
        .eq("topic", sessionTopic)
        .maybeSingle();

      if (memError) logger.warn("MEMORY_FETCH_ERROR", memError.message);

      if (memory) {
        longitudinalContext = `
[HISTÓRICO LONGITUDINAL DO ALUNO — TEMA: ${sessionTopic}]
- Nível de Domínio: ${memory.mastery_level || 'Iniciante'}
- Erros Recorrentes: ${memory.misconceptions_detected?.join(", ") || 'Nenhum identificado'}
- Analogias Eficazes: ${memory.effective_analogies?.join(", ") || 'Nenhuma'}
- Último Bloco Concluído: ${memory.block_title || 'Nenhum'}
- Status Cognitivo: ${memory.last_retention_score ? `Retenção em ${memory.last_retention_score}%` : 'Em análise'}
`;
        logger.info("COGNITIVE_HYDRATION", "Longitudinal memory loaded", { topic: sessionTopic, mastery: memory.mastery_level });
      } else {
        longitudinalContext = `[HISTÓRICO: Aluno iniciando este tema pela primeira vez.]`;
      }
    }

    // 3. PEDAGOGICAL STATE MANAGEMENT
    const currentBlock = session?.current_block ?? bodyBlock ?? bodyPedContext?.currentBlock ?? "BLOCO_1_MISSAO_CLINICA";
    const cognitiveState = memory?.mastery_level || bodyPedContext?.cognitiveState || "INITIAL";

    // 4. AI INVOCATION (OpenAI Priority + Quality Lock)
    const aiResponse = await ai({
      taskType: "reasoning",
      complexity: "alta",
      userId,
      messages: [
        { 
          role: "system", 
          content: `${PROMPT_COMPLETO}
          
ASSUNTO ATUAL: ${sessionTopic || "Geral"}
ESTÁGIO PEDAGÓGICO: ${currentBlock}
ESTADO COGNITIVO DO ALUNO: ${cognitiveState}
${longitudinalContext}

Responda OBRIGATORIAMENTE em JSON conforme especificado no manual do preceptor.` 
        },
        { 
          role: "user", 
          content: newTopic 
            ? `Quero iniciar/mudar para o tema: ${newTopic}. Comece do Bloco 1.` 
            : (message || "Continuar explicação") 
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }, { skipQualityLock: false });

    // 5. RESPONSE NORMALIZATION (Anti-corruption Layer)
    const rawContent = aiResponse.choices?.[0]?.message?.content || "";
    let parsedContent: any = {};
    
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (e) {
      logger.warn("AI_PARSE_ERROR", "AI returned invalid JSON, attempting recovery", { rawContent });
      parsedContent = { content: rawContent, socraticQuestion: "O que você achou desta explicação?" };
    }

    const content = parsedContent.content || parsedContent.explanation || "Erro ao processar conteúdo pedagógico.";
    const socraticQuestion = parsedContent.socraticQuestion || "";

    // 6. IDEMPOTENT PERSISTENCE (Hardening)
    // Update Memory
    if (userId && sessionTopic) {
      const { error: upsertError } = await supabaseAdmin
        .from("tutor_learning_memory")
        .upsert({
          user_id: userId,
          topic: sessionTopic,
          block_title: currentBlock,
          mastery_level: parsedContent.mastery_level || cognitiveState,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,topic' });
      
      if (upsertError) logger.error("MEMORY_UPSERT_FAILED", upsertError.message);
    }

    // Update Session
    if (sessionId) {
      await supabaseAdmin
        .from("tutor_sessions")
        .update({
          current_block: currentBlock,
          updated_at: new Date().toISOString(),
          topic: sessionTopic,
          cognitive_progress: Math.min(100, (session?.cognitive_progress || 0) + 10)
        })
        .eq("id", sessionId);
    }

    // 7. RETURN RESILIENT RESPONSE
    return corsResponse({
      success: true,
      content: content + (socraticQuestion ? `\n\n${socraticQuestion}` : ""),
      currentBlock,
      topic: sessionTopic,
      teachingMode: parsedContent.teachingMode || "PRECEPTOR",
      interactionMode: parsedContent.interactionMode || "BALANCED",
      socraticQuestion,
      correlation_id: correlationId,
      request_id: requestId,
      longitudinal_active: !!longitudinalContext
    }, 200);

  } catch (error) {
    logger.critical("TUTOR_V3_FATAL", error.message, { stack: error.stack });
    return corsResponse({
      success: false,
      error: "O Preceptor ENAZIZI está recalibrando sua base de conhecimento. Por favor, tente em alguns segundos.",
      debug_id: requestId
    }, 500);
  }
}));
