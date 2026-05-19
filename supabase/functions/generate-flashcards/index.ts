// generate-flashcards - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAuth } from "../_shared/enterprise-edge/auth-guard.ts";
import { callAi } from "../_shared/enterprise-edge/ai-router.ts";
import { ALLOWED_MODELS } from "../_shared/ai-model-registry.ts";
import { FLASHCARD_MOTOR_PREMIUM } from "../_shared/premium-motors.ts";


Deno.serve(enterpriseEdgeHandler("generate-flashcards", async ({ req, logger, supabaseAdmin, ai }) => {
  const { user } = await requireAuth(req);
  const body = await req.json().catch(() => ({}));
  const topic = body.topic || "Geral";

  logger.info("FLASHCARD_GEN_START", "Generating high-retention flashcards", { userId: user.id, topic });

  const aiResponse = await ai({
    taskType: "generation",
    messages: [
      { role: "system", content: FLASHCARD_MOTOR_PREMIUM },
      { role: "user", content: `Gere 5 flashcards médicos de alta retenção (FSRS) sobre o tema: ${topic}. 
      Retorne em formato JSON array: [{"question": "...", "answer": "...", "explanation": "...", "priority": 0-100}]. 
      Foque em gatilhos de prova e evite textos longos.` }
    ],
    complexity: "medium"
  });

  const rawContent = aiResponse.choices?.[0]?.message?.content || "[]";
  const cards = parseAiJson(rawContent);

  if (cards.length > 0) {
    const { error: insertErr } = await supabaseAdmin.from("flashcards").insert(
      cards.map((c: any) => ({
        user_id: user.id,
        question: c.question,
        answer: c.answer,
        explanation: c.explanation,
        topic: topic,
        difficulty: c.priority > 80 ? 3 : 2,
        metadata: { generation_engine: "ENAZIZI Flashcard Motor v3.0" }
      }))
    );
    if (insertErr) logger.error("FLASHCARD_INSERT_FAIL", insertErr.message);
  }

  return new Response(JSON.stringify({ success: true, count: cards.length, cards }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}));
