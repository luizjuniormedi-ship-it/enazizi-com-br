import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { requireAdmin } from "../_shared/enterprise-edge/auth-guard.ts";
import { reviewAndEnrich } from "../_shared/question-review-engine.ts";

Deno.serve(enterpriseEdgeHandler("question-review-pipeline", async ({ req, logger, waitUntil, correlation, supabaseAdmin }) => {
  const { user } = await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  
  const batchSize = Math.min(body.batch_size || 5, 20);
  const targetBanca = body.target_banca || null;
  const forceEnrich = body.force_enrich || false;

  // 1. Fetch questions to review
  let query = supabaseAdmin.from("questions_bank")
    .select("*")
    .order("created_at", { ascending: false });

  if (body.ids && body.ids.length > 0) {
    query = query.in("id", body.ids);
  } else {
    // Only fetch non-GOLD or unreviewed questions
    if (!forceEnrich) {
      query = query.or("quality_tier.is.null,quality_tier.neq.GOLD");
    }
  }

  const { data: questions, error: fetchError } = await query.limit(batchSize);
  if (fetchError) throw fetchError;

  const totalQuestions = questions?.length || 0;
  logger.info("PIPELINE_START", `Auditing ${totalQuestions} questions`, { batchSize, targetBanca });

  const processBatch = async () => {
    let processed = 0;
    let goldCount = 0;
    let rejectedCount = 0;

    for (const q of (questions || [])) {
      try {
        const startTime = Date.now();
        const result = await reviewAndEnrich(q, targetBanca, logger, supabaseAdmin);
        const latency = Date.now() - startTime;

        // Update question
        const { error: updateError } = await supabaseAdmin.from("questions_bank").update({
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
          board: result.banca_style_detected || q.board,
          guideline_reference: result.guideline_reference,
          review_status: "reviewed",
          updated_at: new Date().toISOString()
        }).eq("id", q.id);

        if (updateError) throw updateError;

        // Insert flashcards
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
            generation_method: "question_review_pipeline",
            source: `Question ID: ${q.id}`
          }));
          await supabaseAdmin.from("flashcards").insert(flashcardsToInsert);
        }

        // Log governance
        await supabaseAdmin.from("pipeline_governance").insert({
          source: "question-review-pipeline",
          model_used: "google/gemini-2.5-pro",
          latency_ms: latency,
          quality_score: result.scores.clinical_density_score,
          upgrade_status: result.quality_tier,
          correlation_id: correlation,
          metadata: { question_id: q.id, flashcards_created: result.flashcards?.length || 0 }
        });

        processed++;
        if (result.quality_tier === "GOLD") goldCount++;
        if (result.quality_tier === "REJECTED") rejectedCount++;

      } catch (err) {
        logger.error("QUESTION_UPGRADE_FAIL", `Failed to upgrade question ${q.id}`, { error: err.message });
        await supabaseAdmin.from("pipeline_alerts").insert({
          source: "question-review-pipeline",
          message: `Failed to upgrade question ${q.id}`,
          severity: "error",
          alert_type: "upgrade_fail",
          metadata: { question_id: q.id, error: err.message }
        });
      }
    }

    logger.info("PIPELINE_COMPLETE", "Batch processing finished", { 
      total: totalQuestions, 
      processed, 
      gold: goldCount, 
      rejected: rejectedCount 
    });
  };

  if (body.background) {
    waitUntil(processBatch());
    return new Response(JSON.stringify({ 
      status: "processing", 
      batch_size: totalQuestions,
      correlation_id: correlation 
    }), { headers: { "Content-Type": "application/json" } });
  } else {
    await processBatch();
    return new Response(JSON.stringify({ 
      status: "completed", 
      processed: totalQuestions,
      correlation_id: correlation 
    }), { headers: { "Content-Type": "application/json" } });
  }
}));
