// mentor-chat - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import ENAZIZI_PROMPT from "../_shared/enazizi-prompt.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { detectInjection, isOffTopic, SAFE_RESPONSE, OFF_TOPIC_RESPONSE } from "../_shared/injection-guard.ts";

Deno.serve(enterpriseEdgeHandler("mentor-chat", async ({ req, logger, waitUntil, supabaseAdmin }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const { messages, conversationId, jsonResponse, pedagogicalContext } = body;

  // ── INJECTION GUARD ──────────────────────────────────────────────
  const lastUserMessage = [...(messages || [])].reverse().find((m: any) => m.role === "user")?.content || "";
  if (detectInjection(lastUserMessage)) {
    logger.warn("[MENTOR_CHAT_INJECTION_BLOCKED]", { userId: user.id, preview: lastUserMessage.slice(0, 80) });
    return new Response(JSON.stringify({ ok: true, content: SAFE_RESPONSE, injectionBlocked: true }), { headers: { "Content-Type": "application/json" } });
  }
  if (isOffTopic(lastUserMessage)) {
    return new Response(JSON.stringify({ ok: true, content: OFF_TOPIC_RESPONSE, offTopicRedirect: true }), { headers: { "Content-Type": "application/json" } });
  }
  // ── END INJECTION GUARD ──────────────────────────────────────────

  // ── PEDAGOGICAL INCREMENTAL GENERATION ────────────────────────────
  let systemPrompt = ENAZIZI_PROMPT;
  if (pedagogicalContext) {
    const { currentBlock, tutorMode, cognitiveState, topic } = pedagogicalContext;
    systemPrompt += `\n\n
==================================================
🚀 MODO DE PRECEPTORIA INCREMENTAL ATIVO
==================================================
IMPORTANTE:
- Você deve gerar SOMENTE o BLOCO solicitado agora.
- NÃO avance para blocos futuros.
- NÃO faça resumos finais antecipados.
- Sua resposta deve ser focada exclusivamente no objetivo pedagógico do bloco atual.

ESTADO DA SESSÃO:
- Tema: ${topic}
- Bloco atual: ${currentBlock}
- Modo: ${tutorMode}
- Estado Cognitivo: ${cognitiveState}

INSTRUÇÃO: Gere o conteúdo para o BLOCO ${currentBlock}. Se o modo for 'recovery', use analogias ultra-didáticas. Se for 'mastery', aumente o desafio clínico.
==================================================`;
  }

  const aiResponse = await callAi({
    model: ALLOWED_MODELS.generation,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: !jsonResponse,
    max_tokens: 4000,
  }, logger, supabaseAdmin);

  if (jsonResponse) {
    const data = await aiResponse;
    const content = data.choices?.[0]?.message?.content || "";
    if (conversationId) {
      waitUntil(supabaseAdmin.from("chat_messages").insert({ conversation_id: conversationId, role: "assistant", content, user_id: user.id }));
    }
    return new Response(JSON.stringify({ ok: true, content }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(aiResponse.body, { headers: { "Content-Type": "text/event-stream" } });
}));
