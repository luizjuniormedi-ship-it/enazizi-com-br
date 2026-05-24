import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";

/**
 * MENTOR CHAT — ENTERPRISE HARDENING v2
 * High-resilience chat orchestrator.
 */
Deno.serve(enterpriseEdgeHandler("mentor-chat", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId, userId } = correlation;

  try {
    if (!userId) throw new Error("UNAUTHORIZED: Session required");

    const body = await req.json().catch(() => ({}));
    const { messages, conversationId, topic, currentBlock } = body;

    if (!messages || !Array.isArray(messages)) {
      throw new Error("BAD_REQUEST: Messages array expected");
    }

    // ── 1. PEDAGOGICAL INJECTION ──────────────────────────────────────────
    let enhancedSystemPrompt = PROMPT_COMPLETO;
    if (topic) {
      enhancedSystemPrompt += `\n\nTEMA EM FOCO: ${topic}\nBLOCO ATUAL: ${currentBlock || 1}`;
    }

    // ── 2. AI EXECUTION (Prioritize stability) ──────────────────────────────
    const response = await ai({
      taskType: "generation",
      complexity: "média",
      userId,
      messages: [
        { role: "system", content: enhancedSystemPrompt },
        ...messages
      ]
    }, { retries: 2 });

    const content = response.choices?.[0]?.message?.content || "";

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
