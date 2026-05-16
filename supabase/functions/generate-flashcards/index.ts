// generate-flashcards - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
// Mission: High-impact clinical flashcard generation with streaming.

import { enterpriseEdgeHandler, EnterpriseContext } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";

export default enterpriseEdgeHandler("generate-flashcards", async ({ req, logger, supabaseAdmin }: EnterpriseContext) => {
  // 1. AUTH
  const { user } = await requireAuth(req);
  
  // 2. PARSE
  const body = await req.json().catch(() => ({}));
  const { topic, messages = [] } = body;

  logger.info("FLASHCARDS_START", "Generating flashcard block", { topic });

  const systemPrompt = `Você é o GERADOR OFICIAL DE FLASHCARDS do sistema ENAZIZI.
Gere flashcards médicos de alto rendimento sobre ${topic || "temas variados"}.
Cada flashcard deve ter: CASO CLÍNICO, PERGUNTA, RESPOSTA, EXPLICAÇÃO e PONTO DE PROVA.`;

  // 3. AI STREAMING
  const aiResponse = await callAi({
    model: ALLOWED_MODELS.generation,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: 4000,
  }, logger, supabaseAdmin);

  return new Response(aiResponse.body, {
    headers: { "Content-Type": "text/event-stream" },
  });
});
