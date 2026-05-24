import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";

/**
 * TUTOR V3 PREMIUM — ENTERPRISE HARDENING v3
 * High-stability longitudinal pedagogical engine with real streaming.
 */
Deno.serve(enterpriseEdgeHandler("tutor-v3-premium", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId, userId } = correlation;

  try {
    if (!userId) throw new Error("UNAUTHORIZED: Session required");

    const body = await req.json().catch(() => ({}));
    const { message, sessionId, currentBlock: bodyBlock, newTopic, pedagogicalContext, stream = true } = body;

    // ── 1. SESSION RECOVERY & HYDRATION ──────────────────────────────────────────
    let session = null;
    let topic = newTopic || pedagogicalContext?.topic;
    
    if (sessionId) {
      const { data, error } = await supabaseAdmin
        .from("tutor_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      
      if (error) {
        logger.error("SESSION_LOAD_FAIL", error.message);
      } else {
        session = data;
        if (!topic) topic = session?.topic;
      }
    }

    if (!topic) {
       logger.warn("MISSING_TOPIC", "Request without topic context", { requestId });
    }

    // ── 2. LONGITUDINAL MEMORY SYNC ──────────────────────────────────────────────
    let memoryContext = "";
    let masteryLevel = "INITIAL";
    
    if (userId && topic) {
      const { data: mem, error: memErr } = await supabaseAdmin
        .from("tutor_learning_memory")
        .select("*")
        .eq("user_id", userId)
        .eq("topic", topic)
        .maybeSingle();
      
      if (memErr) logger.warn("MEMORY_SYNC_FAIL", memErr.message);
      
      if (mem) {
        masteryLevel = mem.mastery_level || "INITIAL";
        memoryContext = `
[MEMÓRIA COGNITIVA LONGITUDINAL]
- Nível de Domínio: ${masteryLevel}
- Erros em Provas Anteriores: ${mem.misconceptions_detected?.join(", ") || "Nenhum"}
- Blocos Teóricos já Vistos: ${mem.block_title || "Introdução"}
- Pontos de Travamento Identificados: ${mem.explanation_summary || "Nenhum"}
`;
        logger.info("COGNITIVE_RECALL", `Hydrated context for ${topic}`, { mastery: masteryLevel });
      }
    }

    // ── 3. AI PRECEPTORSHIP (High Reasoning Tier) ─────────────────────────────────
    const currentStage = session?.current_block || bodyBlock || "BLOCO_1_MISSAO_CLINICA";
    
    const aiConfig: any = {
      taskType: "tutor_deep", // Trigger pedagogical blocks check
      complexity: "alta",
      userId,
      stream,
      messages: [
        { 
          role: "system", 
          content: `${PROMPT_COMPLETO}
          
CONTEXTO OPERACIONAL:
- TEMA: ${topic || "Medicina Geral"}
- ESTÁGIO: ${currentStage}
- DOMÍNIO DO ALUNO: ${masteryLevel}
${memoryContext}

REGRAS CRÍTICAS:
- Responda seguindo RIGOROSAMENTE a estrutura de 15 blocos pedagógicos se for o início de um tema.
- Mantenha a identidade de Preceptor ENAZIZI.
- Seja profundo tecnicamente, mas didático.
- Se não estiver em modo streaming, responda OBRIGATORIAMENTE em JSON.` 
        },
        { role: "user", content: newTopic ? `Olá. Vamos iniciar o tema ${newTopic}.` : (message || "Continuar aula") }
      ]
    };

    if (!stream) {
      aiConfig.response_format = { type: "json_object" };
    }

    const aiResponse = await ai(aiConfig, { retries: 2 });

    // Handle Streaming response
    if (stream) {
      return aiResponse;
    }

    // ── 4. STABILITY LAYER (Output Normalization for Non-Streaming) ───────────────────────────────
    const rawAi = aiResponse.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawAi);
    } catch (e) {
      logger.error("CORRUPTED_AI_OUTPUT", "JSON parse failed", { rawAi });
      parsed = { content: rawAi, socraticQuestion: "Ficou clara essa explicação?" };
    }

    // ── 5. IDEMPOTENT PERSISTENCE (The Hardening Core) ──────────────────────────
    if (userId && topic) {
      supabaseAdmin.from("tutor_learning_memory").upsert({
        user_id: userId,
        topic: topic,
        block_title: currentStage,
        mastery_level: parsed.mastery_level || masteryLevel,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,topic' }).then();
      
      if (sessionId) {
        supabaseAdmin.from("tutor_sessions").update({
          current_block: currentStage,
          topic: topic,
          updated_at: new Date().toISOString()
        }).eq("id", sessionId).then();
      }
    }

    // ── 6. RETURN HARDENED RESPONSE ─────────────────────────────────────────────
    return corsResponse({
      success: true,
      content: parsed.content || "Erro pedagógico.",
      socraticQuestion: parsed.socraticQuestion || "",
      currentBlock: currentStage,
      topic: topic,
      longitudinal_sync: !!memoryContext,
      correlation_id: correlationId
    }, 200);

  } catch (err) {
    logger.critical("HARDENED_RUNTIME_CRASH", err.message, { requestId });
    
    supabaseAdmin.from("runtime_incidents").insert({
      function_name: "tutor-v3-premium",
      incident_type: "runtime_crash",
      severity: "critical",
      message: err.message,
      correlation_id: correlationId,
      user_id: userId
    }).then();

    return corsResponse({
      success: false,
      error: "O sistema Tutor está instável. Recalibrando...",
      recovery_available: true,
      request_id: requestId
    }, 500);
  }
});