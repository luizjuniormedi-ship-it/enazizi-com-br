// upgrade-questions - ENAZIZI ENTERPRISE UNIFIED FRAMEWORK
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { reviewAndEnrich } from "../_shared/question-review-engine.ts";

Deno.serve(enterpriseEdgeHandler("upgrade-questions", async ({ req, logger, waitUntil, correlation, supabaseAdmin }) => {
  const { user } = await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(body.batch_size || 5, 20);
  const ids: string[] | undefined = body.ids;

  let query = supabaseAdmin.from("questions_bank")
    .select("*")
    .in("quality_tier", ["needs_upgrade", "basic", "SILVER", "BASIC"])
    .order("created_at", { ascending: false })
    .limit(batchSize);

  if (ids && ids.length > 0) {
    query = supabaseAdmin.from("questions_bank").select("*").in("id", ids).limit(batchSize);
  }

  const { data: questions, error: fetchError } = await query;
  if (fetchError) throw fetchError;

  const processUpgrade = async () => {
    for (const q of (questions || [])) {
      try {
        const startTime = Date.now();
        const result = await reviewAndEnrich(q, body.target_banca || null, logger, supabaseAdmin);
        const latency = Date.now() - startTime;

        await supabaseAdmin.from("questions_bank").update({
          statement: result.statement,
          options: result.options,
          correct_index: result.correct_index,
          explanation: result.explanation,
          quality_tier: result.quality_tier,
          clinical_density_score: result.scores.clinical_density_score,
          reasoning_score: result.scores.reasoning_score,
          distractor_quality_score: result.scores.distractor_quality_score,
          guideline_score: result.scores.guideline_score,
          board_similarity_score: result.scores.board_similarity_score,
          cognitive_complexity_score: result.scores.cognitive_complexity_score,
          realism_score: result.scores.realism_score,
          review_status: "reviewed",
          updated_at: new Date().toISOString(),
        }).eq("id", q.id);

        // Flashcards integration
        if (result.flashcards && result.flashcards.length > 0 && result.quality_tier === "GOLD") {
          const flashcardsToInsert = result.flashcards.map(f => ({
            question: f.question,
            answer: f.answer,
            explanation: f.explanation,
            topic: q.topic,
            subtopic_id: q.subtopic_id,
            specialty_id: q.specialty_id,
            user_id: user.id,
            is_global: true,
            generation_method: "upgrade_questions_pipeline"
          }));
          await supabaseAdmin.from("flashcards").insert(flashcardsToInsert);
        }

        // Governance log
        await supabaseAdmin.from("pipeline_governance").insert({
          pipeline_name: "upgrade-questions",
          function_name: "upgrade-questions",
          model_used: "google/gemini-2.5-pro",
          latency_ms: latency,
          status: result.quality_tier,
          metadata: { correlation_id: correlation, question_id: q.id }
        });

      } catch (err) {
        logger.error("UPGRADE_FAIL", `Question ${q.id} failed: ${err.message}`);
      }
    }
  };

  if (body.background) {
    waitUntil(processUpgrade());
    return new Response(JSON.stringify({ status: "processing", correlation_id: correlation }), { headers: { "Content-Type": "application/json" } });
  } else {
    await processUpgrade();
    return new Response(JSON.stringify({ status: "completed", correlation_id: correlation }), { headers: { "Content-Type": "application/json" } });
  }
}));

