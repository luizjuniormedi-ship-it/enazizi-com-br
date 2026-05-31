// upgrade-questions - ENAZIZI ENTERPRISE — Plano Agressivo de Enriquecimento Global
// Suporta priority_filter (rejected|basic|silver|rest|auto), kill switch via enrichment_control,
// snapshot em previous_version e auto-pause por alta taxa de rejeição.
import { enterpriseEdgeHandler } from "../_shared/enterprise-edge/enterprise-edge-handler.ts";
import { reviewAndEnrich } from "../_shared/question-review-engine.ts";

// gpt-4o-mini pricing (US$ por 1k tokens)
const COST_IN_PER_1K = 0.00015;
const COST_OUT_PER_1K = 0.0006;

type Priority = "rejected" | "basic" | "silver" | "rest" | "auto";

Deno.serve(enterpriseEdgeHandler("upgrade-questions", async ({ req, logger, waitUntil, correlation, supabaseAdmin }) => {
  const authHeader = req.headers.get("Authorization");
  const body = await req.json().catch(() => ({}));

  let userId = "a845ec5d-7afb-4cb9-8aa8-95ae2ea9d023";
  if (authHeader) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (user) userId = user.id;
  }

  // 1. Kill switch
  const { data: control } = await supabaseAdmin
    .from("enrichment_control").select("*").eq("id", 1).maybeSingle();
  if (control?.is_paused) {
    return new Response(JSON.stringify({
      skipped: true, reason: control.pause_reason || "paused", correlation
    }), { headers: { "Content-Type": "application/json" } });
  }

  const batchSize = Math.min(body.batch_size || 4, 20);
  const ids: string[] | undefined = body.ids;
  const priority: Priority = body.priority_filter || "auto";

  // 2. Priority selection cascade
  const fetchByPriority = async (p: Priority) => {
    let q = supabaseAdmin.from("questions_bank").select("*").eq("is_global", true);
    if (p === "rejected") {
      q = q.eq("quality_tier", "needs_upgrade");
    } else if (p === "basic") {
      q = q.in("quality_tier", ["needs_upgrade", "basic", "BASIC"]).is("guideline_reference", null);
    } else if (p === "silver") {
      q = q.in("quality_tier", ["silver", "SILVER"]).eq("is_clinical_case", false);
    } else {
      q = q.in("quality_tier", ["needs_upgrade", "basic", "BASIC", "silver", "SILVER"]);
    }
    return q.order("created_at", { ascending: true }).limit(batchSize);
  };

  let questions: any[] = [];
  if (ids?.length) {
    const { data } = await supabaseAdmin.from("questions_bank").select("*").in("id", ids).limit(batchSize);
    questions = data || [];
  } else if (priority === "auto") {
    for (const p of ["rejected", "basic", "silver", "rest"] as Priority[]) {
      const { data } = await fetchByPriority(p);
      questions = data || [];
      if (questions.length > 0) break;
    }
  } else {
    const { data } = await fetchByPriority(priority);
    questions = data || [];
  }

  if (questions.length === 0) {
    return new Response(JSON.stringify({ status: "empty_queue", correlation }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const processUpgrade = async () => {
    let enriched = 0, rejected = 0, costUsd = 0;
    for (const q of questions) {
      try {
        const startTime = Date.now();

        // 3. Snapshot antes do update (idempotente)
        if (!q.previous_version) {
          await supabaseAdmin.from("questions_bank").update({
            previous_version: {
              statement: q.statement,
              options: q.options,
              correct_index: q.correct_index,
              explanation: q.explanation,
              quality_tier: q.quality_tier,
              snapshotted_at: new Date().toISOString()
            }
          }).eq("id", q.id);
        }

        const result = await reviewAndEnrich(q, body.target_banca || null, logger, supabaseAdmin);
        const latency = Date.now() - startTime;

        const tier = (result.quality_tier || "BASIC").toLowerCase();
        const callCost =
          ((result.tokens_in || 0) / 1000) * COST_IN_PER_1K +
          ((result.tokens_out || 0) / 1000) * COST_OUT_PER_1K;
        costUsd += callCost;

        if (tier === "rejected") {
          rejected++;
        } else {
          enriched++;
        }

        await supabaseAdmin.from("questions_bank").update({
          statement: result.statement,
          options: result.options,
          correct_index: result.correct_index,
          explanation: result.explanation,
          quality_tier: result.quality_tier,
          guideline_reference: result.guideline_reference || null,
          guideline_year: result.guideline_year || null,
          is_clinical_case: result.is_clinical_case ?? null,
          tri_difficulty_score: result.tri_difficulty_score ?? null,
          clinical_density_score: result.scores?.clinical_density_score,
          reasoning_score: result.scores?.reasoning_score,
          distractor_quality_score: result.scores?.distractor_quality_score,
          guideline_score: result.scores?.guideline_score,
          board_similarity_score: result.scores?.board_similarity_score,
          cognitive_complexity_score: result.scores?.cognitive_complexity_score,
          realism_score: result.scores?.realism_score,
          review_status: "reviewed",
          updated_at: new Date().toISOString(),
        }).eq("id", q.id);

        if (result.flashcards?.length && result.quality_tier === "GOLD") {
          await supabaseAdmin.from("flashcards").insert(
            result.flashcards.map(f => ({
              question: f.question, answer: f.answer, explanation: f.explanation,
              topic: q.topic, subtopic_id: q.subtopic_id, specialty_id: q.specialty_id,
              user_id: userId, is_global: true,
              generation_method: "upgrade_questions_pipeline"
            }))
          );
        }

        await supabaseAdmin.from("pipeline_governance").insert({
          pipeline_name: "upgrade-questions",
          function_name: "upgrade-questions",
          model_used: "openai/gpt-4o-mini",
          latency_ms: latency,
          status: result.quality_tier,
          metadata: {
            correlation_id: correlation.correlationId || correlation,
            question_id: q.id,
            priority,
            tokens_in: result.tokens_in,
            tokens_out: result.tokens_out,
            cost_usd: Number(callCost.toFixed(6))
          }
        });
      } catch (err) {
        logger.error("UPGRADE_FAIL", `Question ${q.id} failed: ${err.message}`);
        rejected++;
      }
    }

    // 4. Update control + auto-pause defensivo
    const total = enriched + rejected;
    const rejectionRate = total > 0 ? rejected / total : 0;
    const updates: any = {
      last_batch_at: new Date().toISOString(),
      processed_today: (control?.processed_today || 0) + enriched,
      updated_at: new Date().toISOString()
    };
    if (rejectionRate > 0.30 && total >= 4) {
      updates.is_paused = true;
      updates.pause_reason = `auto: rejection_rate=${(rejectionRate * 100).toFixed(0)}% in last ${total}`;
      logger.warn("AUTO_PAUSE", updates.pause_reason);
    }
    await supabaseAdmin.from("enrichment_control").upsert({ id: 1, ...updates });

    logger.info("BATCH_DONE", `enriched=${enriched} rejected=${rejected} cost=$${costUsd.toFixed(4)}`);
    return { enriched, rejected, costUsd };
  };

  if (body.background) {
    waitUntil(processUpgrade());
    return new Response(JSON.stringify({
      status: "processing", batch: questions.length, priority, correlation
    }), { headers: { "Content-Type": "application/json" } });
  }
  const result = await processUpgrade();
  return new Response(JSON.stringify({
    status: "completed", batch: questions.length, ...result, priority, correlation
  }), { headers: { "Content-Type": "application/json" } });
}));
