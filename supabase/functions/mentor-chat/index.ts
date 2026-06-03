import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";
import { runAI } from "../_shared/ai-runtime-orchestrator.ts";

/**
 * MENTOR CHAT — ENTERPRISE HARDENING v2
 * High-resilience chat orchestrator.
 */
Deno.serve(enterpriseEdgeHandler("mentor-chat", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId, userId } = correlation;

  try {
    if (!userId) throw new Error("UNAUTHORIZED: Session required");

    const body = await req.json().catch(() => ({}));
    let { messages, conversationId, topic, currentBlock } = body;
    const { message } = body;

    // ── PAYLOAD NORMALIZATION (HOTFIX P0 — legacy/diagnostic caller compat) ──
    if ((!messages || !Array.isArray(messages) || messages.length === 0) && typeof message === "string" && message.trim()) {
      messages = [{ role: "user", content: message }];
      logger.info("MENTOR_PAYLOAD_NORMALIZED", `legacy { message } → messages[1]`);
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("BAD_REQUEST: Messages array expected");
    }

    logger.info("MENTOR_CHAT_REQUEST_VALID", `msgs=${messages.length} conv=${conversationId || "-"}`);


    // ── 1. PEDAGOGICAL INJECTION (Unified Enterprise logic) ──────────────────
    let enhancedSystemPrompt = PROMPT_COMPLETO;
    
    if (topic) {
      enhancedSystemPrompt += `
      
==================================================
🚨 REGRA ABSOLUTA: GERAÇÃO DE BLOCO ÚNICO
==================================================
Você está no MODO DE PRECEPTORIA ITERATIVA. 
Sua missão é gerar APENAS UM BLOCO por vez (BLOCO ATUAL: ${currentBlock || 1}). 
É PROIBIDO gerar roadmap completo ou outros blocos.
TEMA: ${topic}

Ao concluir o bloco, encerre com a pergunta obrigatória: 
"Antes de avançar, escolha uma opção: A) Entendi, avançar B) Aprofundar C) Simplificar D) Explicar por analogia E) Ver exemplo clínico"
==================================================`;
    }

    // ── 2. AI EXECUTION via runAI orchestrator (LOTE 2) ────────────────────
    logger.info("MENTOR_CHAT_RUNAI_START", `task=tutor_chat`);
    let aiResult;
    try {
      aiResult = await runAI({
        taskType: "tutor_chat",
        complexity: "medium",
        topic: topic || null,
        userId,
        requestId,
        sessionId: conversationId || null,
        supabase: supabaseAdmin,
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          ...messages
        ],
      });
      logger.info("MENTOR_CHAT_RUNAI_OK", `provider=${aiResult?.provider || "?"} model=${aiResult?.model || "?"}`);
    } catch (aiErr) {
      logger.error("MENTOR_CHAT_RUNAI_FAIL", (aiErr as Error).message);
      throw aiErr;
    }

    const content = aiResult.content || "";


    // ── 3. RESILIENT PERSISTENCE ───────────────────────────────────────────
    if (conversationId) {
      // Async message saving
      supabaseAdmin.from("chat_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content,
        metadata: { request_id: requestId, correlation_id: correlationId }
      }).then(({ error }) => {
        if (error) logger.error("CHAT_SAVE_FAIL", error.message);
      });

      // Session Upsert (Prevent duplicates)
      if (topic) {
        supabaseAdmin.from("tutor_sessions").upsert({
          conversation_id: conversationId,
          user_id: userId,
          topic: topic,
          current_block: String(currentBlock || 1),
          updated_at: new Date().toISOString()
        }, { onConflict: 'conversation_id' }).then(({ error }) => {
          if (error) logger.error("SESSION_UPSERT_FAIL", error.message);
        });
      }
    }

    return corsResponse({
      success: true,
      content,
      request_id: requestId,
      correlation_id: correlationId
    }, 200);

  } catch (err) {
    logger.error("MENTOR_CHAT_RUNTIME_ERROR", err.message);
    
    // Telemetry incident
    supabaseAdmin.from("runtime_incidents").insert({
      function_name: "mentor-chat",
      incident_type: "chat_failure",
      severity: "warning",
      message: err.message,
      correlation_id: correlationId,
      user_id: userId
    }).then();

    return corsResponse({
      success: false,
      error: "Tivemos um problema ao processar sua dúvida médica.",
      request_id: requestId
    }, 500);
  }
}));
