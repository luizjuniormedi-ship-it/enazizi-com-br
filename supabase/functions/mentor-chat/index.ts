import { enterpriseEdgeHandler, corsHeaders } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { corsResponse } from "../_shared/cors.ts";
import { PROMPT_COMPLETO } from "../_shared/enazizi-prompt.ts";

/**
 * MENTOR CHAT — ENTERPRISE HARDENING
 * Standard Chat Engine with Pedagogical Context Support
 */
Deno.serve(enterpriseEdgeHandler("mentor-chat", async ({ req, logger, supabaseAdmin, ai, correlation }) => {
  const { requestId, correlationId, userId } = correlation;

  try {
    if (!userId) throw new Error("UNAUTHORIZED: Authentication required");

    const body = await req.json().catch(() => ({}));
    const { messages, conversationId, pedagogicalContext } = body;

    if (!messages || !Array.isArray(messages)) {
      throw new Error("INVALID_REQUEST: Messages array is required");
    }

    // 1. CONTEXT HYDRATION
    let systemPrompt = PROMPT_COMPLETO;
    if (pedagogicalContext) {
      systemPrompt += `
      
[MODO PEDAGÓGICO ATIVO]
- Tema: ${pedagogicalContext.topic || "Geral"}
- Bloco Atual: ${pedagogicalContext.currentBlock || 1}
- Nível: ${pedagogicalContext.cognitiveState || "Iniciante"}
`;
    }

    // 2. AI CALL (Standard Generation)
    const response = await ai({
      taskType: "generation",
      complexity: "média",
      userId,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      stream: false // Mentor chat usually handled with discrete messages for better persistence
    });

    const content = response.choices?.[0]?.message?.content || "";

    // 3. IDEMPOTENT PERSISTENCE
    if (conversationId) {
      // Save Message
      await supabaseAdmin.from("chat_messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content,
        metadata: { correlation_id: correlationId, request_id: requestId }
      });

      // Update Session/Conversation State (Upsert-like via update)
      if (pedagogicalContext?.topic) {
        const { error: sessionError } = await supabaseAdmin
          .from("tutor_sessions")
          .upsert({
            conversation_id: conversationId,
            user_id: userId,
            topic: pedagogicalContext.topic,
            current_block: String(pedagogicalContext.currentBlock || 1),
            updated_at: new Date().toISOString()
          }, { onConflict: 'conversation_id' });
        
        if (sessionError) logger.error("SESSION_UPSERT_ERROR", sessionError.message);
      }
    }

    return corsResponse({
      success: true,
      content,
      correlation_id: correlationId,
      request_id: requestId
    }, 200);

  } catch (error) {
    logger.error("MENTOR_CHAT_ERROR", error.message);
    return corsResponse({
      success: false,
      error: "Mentor ENAZIZI em manutenção. Tente novamente em breve.",
      debug_id: requestId
    }, 500);
  }
}));
