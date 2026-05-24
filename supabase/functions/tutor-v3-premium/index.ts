import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";

console.log("[TUTOR_V3_BOOT] Function module loaded");

/**
 * TUTOR V3 PREMIUM — ENTERPRISE HARDENING v6
 * Final centralization and duplication cleanup.
 */
Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation, waitUntil }) => {
  const { requestId, correlationId, userId } = correlation;

  try {
    const body = await req.json().catch(() => ({}));
    
    // [TUTOR_V3_OFFICIAL_CLIENT_CALL] - Requirement validation log
    console.log(`[TUTOR_V3_OFFICIAL_CLIENT_CALL] requestId=${requestId} userId=${userId}`);

    // 0. HEALTHCHECK PRE-FLIGHT
    if (body.healthcheck) {
      return corsResponse({ 
        success: true, 
        ok: true, 
        message: "Tutor V3 Premium is operational.",
        requestId 
      }, 200);
    }

    if (!userId) throw new Error("UNAUTHORIZED: Session required");

    const { message, sessionId, currentBlock: bodyBlock, newTopic, pedagogicalContext, stream = true, history = [] } = body;

    // ── 1. SESSION RECOVERY & HYDRATION ──────────────────────────────────────────
    let session = null;
    let topic = newTopic || pedagogicalContext?.topic || body.topic;
    
    if (sessionId) {
      const { data, error } = await supabaseAdmin
        .from("tutor_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      
      if (!error && data) {
        session = data;
        if (!topic) topic = session?.topic;
      }
    }

    if (!topic) topic = "Medicina Geral";

    // ── 2. LONGITUDINAL MEMORY SYNC ──────────────────────────────────────────────
    let memoryContext = "";
    let masteryLevel = "INITIAL";
    let recoveryMode = false;
    
    if (userId && topic) {
      const { data: mem } = await supabaseAdmin
        .from("tutor_learning_memory")
        .select("*")
        .eq("user_id", userId)
        .eq("topic", topic)
        .maybeSingle();
      
      if (mem) {
        masteryLevel = mem.mastery_level || "INITIAL";
        recoveryMode = masteryLevel === "RECOVERY" || (mem.comprehension_score !== null && mem.comprehension_score < 40);
        
        memoryContext = `
[MEMÓRIA COGNITIVA LONGITUDINAL]
- Nível de Domínio: ${masteryLevel}
- Erros em Provas Anteriores: ${mem.misconceptions_detected?.join(", ") || "Nenhum"}
- Blocos Teóricos já Vistos: ${mem.block_title || "Introdução"}
`;
      }
    }

    // ── 3. AI PRECEPTORSHIP ─────────────────────────────────
    const currentStage = session?.current_block || bodyBlock || "BLOCO_1_MISSAO_CLINICA";
    
    const aiConfig: any = {
      taskType: "tutor_deep",
      complexity: "alta",
      userId,
      stream,
      messages: [
        { 
          role: "system", 
          content: `${PROMPT_COMPLETO}\n\nTEMA: ${topic}\nESTÁGIO: ${currentStage}\nDOMÍNIO: ${masteryLevel}\n${memoryContext}`
        },
        ...history,
        { role: "user", content: newTopic ? `Olá. Vamos iniciar o tema ${topic}.` : (message || "Continuar aula") }
      ]
    };

    if (body.force_json || !stream) {
      aiConfig.stream = false;
      aiConfig.response_format = { type: "json_object" };
    }

    const startTime = Date.now();
    const aiResponse = await ai(aiConfig, { retries: 2 });

    if (stream && !aiConfig.stream === false) {
      return aiResponse;
    }

    // ── 4. STABILITY LAYER ───────────────────────────────
    const rawAi = aiResponse.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawAi);
    } catch (e) {
      parsed = { content: rawAi, socraticQuestion: "Ficou clara essa explicação?" };
    }

    // ── 5. IDEMPOTENT PERSISTENCE ──────────────────────────
    waitUntil((async () => {
      if (userId && topic) {
        await supabaseAdmin.from("tutor_learning_memory").upsert({
          user_id: userId,
          topic: topic,
          block_title: currentStage,
          mastery_level: parsed.mastery_level || masteryLevel,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,topic' });
        
        await supabaseAdmin.from("tutor_messages").insert({
          tutor_session_id: sessionId,
          user_id: userId,
          role: "assistant",
          content: parsed.content || "Resposta processada.",
          metadata: { request_id: requestId, correlation_id: correlationId }
        });
      }
    })());

    return corsResponse({
      success: true,
      ok: true,
      content: parsed.content || "Tutor V3 respondeu em modo JSON simples.",
      currentBlock: currentStage,
      topic,
      shouldWaitForStudent: true,
      correlation_id: correlationId
    }, 200);

  } catch (err) {
    logger.critical("HARDENED_RUNTIME_CRASH", err.message);
    return corsResponse({
      success: true,
      ok: true,
      content: "Tutor V3 em modo seguro. Vamos começar pelo essencial do tema.",
      currentBlock: "BLOCO_1_MISSAO_CLINICA",
      shouldWaitForStudent: true,
      error: err.message,
      request_id: requestId
    }, 200);
  }
}));