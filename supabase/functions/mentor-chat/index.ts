// mentor-chat - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { getKnowledgeCache, saveKnowledgeCache, extractTopic } from "../_shared/knowledge-cache.ts";
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
    return new Response(JSON.stringify({ ok: true, content: SAFE_RESPONSE, injectionBlocked: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (isOffTopic(lastUserMessage)) {
    return new Response(JSON.stringify({ ok: true, content: OFF_TOPIC_RESPONSE, offTopicRedirect: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  // ── END INJECTION GUARD ──────────────────────────────────────────

  // ── PEDAGOGICAL INCREMENTAL GENERATION ────────────────────────────
  let systemPrompt = ENAZIZI_PROMPT;
  let cachedContext = "";
  
  if (pedagogicalContext) {
    const { currentBlock, tutorMode, cognitiveState, topic, lastInteraction } = pedagogicalContext;
    
    // Check Cache
    const detectedTopicInfo = extractTopic(lastUserMessage) || (topic ? { topic, specialty: "" } : null);
    if (detectedTopicInfo?.topic) {
      const cacheData = await getKnowledgeCache(supabaseAdmin, detectedTopicInfo.topic);
      if (cacheData) {
        cachedContext = `\n\nCONTEXTO DISPONÍVEL (CACHE): \n${cacheData.content}\n`;
        logger.info("[MENTOR_CHAT_CACHE_HIT]", { topic: detectedTopicInfo.topic });
      }
    }

    const blockNames = [
      "Missão Clínica", "Roadmap Cognitivo", "Explicação Leiga", "Fisiopatologia Profunda",
      "Raciocínio Clínico", "Quadro Clínico e Diagnóstico", "Conduta e Tratamento", 
      "Pegadinhas de Prova", "Mapa de Decisão", "Questão Guiada", "Correção Comentada",
      "Active Recall", "Flashcards", "Resumo Ultraobjetivo", "Modo Preceptor"
    ];

    systemPrompt += `\n\n
==================================================
🚨 REGRA ABSOLUTA: GERAÇÃO DE BLOCO ÚNICO
==================================================
Você está no MODO DE PRECEPTORIA ITERATIVA. 
Sua missão é gerar APENAS UM BLOCO por vez. É PROIBIDO gerar roadmap completo ou outros blocos.
${cachedContext}

BLOCO ATUAL: ${currentBlock}: ${blockNames[currentBlock - 1]}
TEMA: ${topic}
MODO ATUAL: ${tutorMode}
ESTADO COGNITIVO: ${cognitiveState}
INTERAÇÃO DO ALUNO: ${lastInteraction || "Explique o tema"}

REGRAS CRÍTICAS:
1. FOCO TOTAL: Gere apenas o conteúdo do BLOCO ${currentBlock}.
2. PROIBIÇÃO: Não escreva sobre blocos futuros, não gere questões se o bloco não for o 10, não gere flashcards se o bloco não for o 13.
3. ADAPTAÇÃO: Se a interação for 'Aprofundar', 'Simplificar', 'Analogia' ou 'Exemplo Clínico', você deve regenerar ou estender o CONTEÚDO DO BLOCO ATUAL (${currentBlock}) de acordo com o pedido, sem avançar para o próximo número.
4. PARADA: Pare imediatamente após concluir o conteúdo do bloco solicitado.

Ao terminar, encerre com a pergunta obrigatória: "Antes de avançar, escolha uma opção: A) Entendi, avançar B) Aprofundar C) Simplificar D) Explicar por analogia E) Ver exemplo clínico"
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
      
      // Save to Cache
      const detectedTopicInfo = extractTopic(lastUserMessage) || (pedagogicalContext?.topic ? { topic: pedagogicalContext.topic, specialty: "" } : null);
      if (!cachedContext && detectedTopicInfo?.topic && content.length > 300) {
        saveKnowledgeCache(
          supabaseAdmin,
          detectedTopicInfo.topic,
          detectedTopicInfo.specialty || "Geral",
          content
        ).catch(e => logger.error("[MENTOR_CACHE_SAVE_ERROR]", e));
      }
    }
    return new Response(JSON.stringify({ ok: true, content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(aiResponse.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
}));