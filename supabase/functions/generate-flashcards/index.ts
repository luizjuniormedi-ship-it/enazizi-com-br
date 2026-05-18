// generate-flashcards - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { FLASHCARD_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";


Deno.serve(enterpriseEdgeHandler("generate-flashcards", async ({ req, logger, supabaseAdmin }) => {
  await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const aiResponse = await callAi({
    model: ALLOWED_MODELS.generation,
    messages: [{ role: "system", content: "Gerador de Flashcards ENAZIZI" }, { role: "user", content: body.topic || "Geral" }],
    stream: true,
  }, logger, supabaseAdmin);
  return new Response(aiResponse.body, { headers: { "Content-Type": "text/event-stream" } });
}));
