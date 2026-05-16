// mentor-chat - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: Intelligent mentorship with real-time streaming and RAG support.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

export default enterpriseEdgeHandler("mentor-chat", async ({ req, logger, waitUntil, correlation }: EnterpriseContext) => {
  // 1. AUTH
  const { user, supabaseAdmin } = await requireAuth(req);
  logger.info("AUTH", "User authenticated", { userId: user.id });

  // 2. PARSE REQUEST
  const body = await req.json().catch(() => ({}));
  const { 
    messages, 
    userContext, 
    conversationId, 
    topic: userTopic,
    jsonResponse = false 
  } = body;

  if (!messages || messages.length === 0) {
    throw new Error("Missing messages");
  }

  const lastUserMessage = messages[messages.length - 1]?.content || "";
  logger.info("MESSAGES_RECEIVED", "Processing chat interaction", { conversationId });

  // 3. SYSTEM PROMPT & CONTEXT
  let systemPrompt = ENAZIZI_PROMPT;
  if (userContext) {
    systemPrompt += `\n\n--- MATERIAL DO ALUNO ---\n${userContext}\n--- FIM ---`;
  }
  if (userTopic) {
    systemPrompt += `\n\n--- CONTEXTO ---\nTópico: ${userTopic}\n--- FIM ---`;
  }

  // 4. PERSIST USER MESSAGE (Background)
  if (conversationId) {
    waitUntil((async () => {
      await supabaseAdmin.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: lastUserMessage,
        user_id: user.id
      });
      logger.info("PERSIST_USER_MSG", "User message saved to DB");
    })());
  }

  // 5. AI EXECUTION
  const stream = !jsonResponse;
  const aiPayload = {
    model: ALLOWED_MODELS.generation,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream,
    max_tokens: 4000,
  };

  const aiResponse = await callAi(aiPayload, logger, supabaseAdmin);

  if (jsonResponse) {
    const data = await aiResponse;
    const content = data.choices?.[0]?.message?.content || "";
    
    // Persist Assistant Message (Background)
    if (conversationId) {
      waitUntil((async () => {
        await supabaseAdmin.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content,
          user_id: user.id
        });
      })());
    }

    return new Response(JSON.stringify({
      ok: true,
      content,
      correlation_id: correlation.correlationId
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Streaming Response
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullText = "";

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const text = decoder.decode(chunk);
      fullText += text;
      controller.enqueue(chunk);
    },
    async flush() {
      // Final persistence and governance
      if (conversationId) {
        waitUntil((async () => {
          await supabaseAdmin.from("chat_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullText,
            user_id: user.id
          });
          logger.info("PERSIST_ASSISTANT_MSG", "Assistant response saved to DB");
          
          // Log to AI governance manually for streaming
          await supabaseAdmin.from("ai_governance_logs").insert({
            model_used: ALLOWED_MODELS.generation,
            status: "success",
            metadata: { 
              correlation_id: correlation.correlationId,
              text_length: fullText.length
            }
          });
        })());
      }
    }
  });

  return new Response(aiResponse.body?.pipeThrough(transformStream), {
    headers: { "Content-Type": "text/event-stream" },
  });
});
