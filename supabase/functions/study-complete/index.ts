/**
 * study-complete — API Assistente Phase 1
 * Atomic study action completion with side effects.
 * Server-side equivalent of completeStudyAction.ts.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery, logDecision,
} from "../_shared/assistant-helpers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json();
    const {
      actionType, actionId, taskId, themeId, topicId, subtopicId,
      questionId, wasCorrect, durationSeconds, metadata,
    } = body;

    if (!actionType) return errorResponse("actionType is required");

    const db = getServiceClient();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const effects: Record<string, boolean> = {};
    const errors: string[] = [];

    // ── 1. Mark review as done ──
    if ((actionType === "review" || actionType === "error_review") && actionId) {
      const { error } = await db.from("revisoes")
        .update({ status: "concluida", updated_at: now })
        .eq("id", actionId).eq("user_id", userId);
      if (error) errors.push(`review: ${error.message}`);
      else effects.reviewUpdated = true;
    }

    // ── 2. Mark error bank item as mastered ──
    if (actionType === "error_review" && actionId) {
      const { error } = await db.from("error_bank")
        .update({ dominado: true, dominado_em: now, updated_at: now })
        .eq("id", actionId).eq("user_id", userId);
      if (!error) effects.errorLogged = true;
    }

    // ── 3. Complete daily plan task ──
    if (taskId) {
      const { error } = await db.from("daily_plan_tasks")
        .update({ completed: true, completed_at: now, updated_at: now })
        .eq("id", taskId).eq("user_id", userId);
      if (!error) effects.taskCompleted = true;
      else errors.push(`task: ${error.message}`);
    }

    // ── 4. Track theme studied ──
    if (topicId || themeId) {
      const topicName = topicId || themeId || "unknown";
      const { error } = await db.from("temas_estudados").upsert({
        user_id: userId,
        tema: topicName,
        especialidade: metadata?.specialty ?? "",
        data_estudo: today,
        status: "revisado",
      }, { onConflict: "user_id,tema" });
      if (!error) effects.themeTracked = true;
    }

    // ── 4b. Feed error_bank when answer was wrong (F2: Sessão alimenta cérebro) ──
    if (wasCorrect === false && (topicId || themeId)) {
      const tema = (topicId || themeId) as string;
      const subtema = (subtopicId || metadata?.subtopic) as string | undefined;
      const categoria = (metadata?.errorCategory as string | undefined) || "conceitual";
      try {
        // Upsert pattern: try to find existing then increment vezes_errado
        const { data: existing } = await db.from("error_bank")
          .select("id, vezes_errado")
          .eq("user_id", userId).eq("tema", tema)
          .eq("dominado", false)
          .order("updated_at", { ascending: false })
          .limit(1).maybeSingle();
        if (existing) {
          await db.from("error_bank")
            .update({
              vezes_errado: (existing.vezes_errado ?? 0) + 1,
              updated_at: now,
              ...(subtema ? { subtema } : {}),
              categoria_erro: categoria,
            })
            .eq("id", existing.id);
        } else {
          await db.from("error_bank").insert({
            user_id: userId,
            tema,
            subtema: subtema ?? null,
            categoria_erro: categoria,
            tipo_questao: actionType === "image_quiz" ? "imagem" : "objetiva",
            conteudo: (metadata?.questionText as string | undefined) ?? null,
            motivo_erro: (metadata?.errorReason as string | undefined) ?? null,
            dificuldade: (metadata?.difficulty as number | undefined) ?? 3,
            vezes_errado: 1,
          });
        }
        effects.errorBankFed = true;
      } catch (e) {
        errors.push(`error_bank_feed: ${(e as Error).message}`);
      }
    }

    // ── 4c. Feed FSRS card when there's a correct/wrong outcome (F2) ──
    if (typeof wasCorrect === "boolean" && (topicId || themeId)) {
      const cardRefId = (topicId || themeId) as string;
      try {
        const { data: existing } = await db.from("fsrs_cards")
          .select("id, reps, lapses, stability, state")
          .eq("user_id", userId)
          .eq("card_type", "topic")
          .eq("card_ref_id", cardRefId)
          .maybeSingle();
        // Lightweight FSRS-like update (full FSRS lives in dedicated function).
        // Here we just keep the card alive so review_fsrs rule can fire.
        const reps = (existing?.reps ?? 0) + 1;
        const lapses = (existing?.lapses ?? 0) + (wasCorrect ? 0 : 1);
        const stability = wasCorrect
          ? Math.min(60, (existing?.stability ?? 0.4) * 1.6)
          : Math.max(0.2, (existing?.stability ?? 0.4) * 0.6);
        const dueOffsetDays = wasCorrect ? Math.max(1, Math.round(stability)) : 1;
        const due = new Date(Date.now() + dueOffsetDays * 86_400_000).toISOString();
        if (existing) {
          await db.from("fsrs_cards").update({
            reps, lapses, stability, due,
            last_review: now, state: wasCorrect ? 2 : 3, updated_at: now,
          }).eq("id", existing.id);
        } else {
          await db.from("fsrs_cards").insert({
            user_id: userId,
            card_type: "topic",
            card_ref_id: cardRefId,
            reps, lapses, stability,
            due, last_review: now,
            state: wasCorrect ? 2 : 3,
          });
        }
        effects.fsrsUpdated = true;
      } catch (e) {
        errors.push(`fsrs_feed: ${(e as Error).message}`);
      }
    }
    // ── 5. Record study action event ──
    await db.from("study_action_events").insert({
      user_id: userId,
      task_type: actionType,
      topic: topicId || themeId || metadata?.topic || "",
      subtopic: subtopicId || metadata?.subtopic || "",
      source: "auto",
      origin_module: metadata?.originModule || "study-complete",
      payload_json: metadata ?? {},
      status: "success",
    }).then(({ error }) => {
      if (error) errors.push(`event: ${error.message}`);
    });

    // ── 5b. Update visual_skill_snapshots for image quiz completions ──
    if ((metadata?.originModule === "image_quiz" || actionType === "image_quiz") && metadata?.imageType) {
      try {
        const imgType = (metadata.imageType as string).toLowerCase();
        // Fetch recent attempts for this image type
        const { data: attempts } = await db.from("medical_image_attempts")
          .select("correct, time_seconds, created_at")
          .eq("user_id", userId)
          .eq("image_type", imgType)
          .order("created_at", { ascending: false })
          .limit(100);

        if (attempts && attempts.length >= 1) {
          const total = attempts.length;
          const correctCount = attempts.filter((a: any) => a.correct).length;
          const accuracy = Math.round((correctCount / total) * 100);
          const avgTime = Math.round(
            attempts.reduce((s: number, a: any) => s + (a.time_seconds || 0), 0) / total
          );
          // Score: for < 5 attempts use only accuracy; otherwise weighted composite
          let score: number;
          if (total < 5) {
            score = accuracy;
          } else {
            const volumeScore = Math.min(100, total * 2);
            const speedScore = avgTime <= 30 ? 100 : avgTime <= 60 ? 80 : avgTime <= 120 ? 50 : 20;
            score = Math.round(accuracy * 0.6 + volumeScore * 0.2 + speedScore * 0.2);
          }

          // Trend: compare recent 5 vs older
          let trend = "stable";
          if (total >= 10) {
            const recent5 = attempts.slice(0, 5);
            const older5 = attempts.slice(5, 10);
            const recentAcc = recent5.filter((a: any) => a.correct).length / 5;
            const olderAcc = older5.filter((a: any) => a.correct).length / 5;
            if (recentAcc - olderAcc > 0.15) trend = "improving";
            else if (recentAcc - olderAcc < -0.15) trend = "declining";
          }

          // Recent window (last 10)
          const recentWindow = attempts.slice(0, Math.min(10, total));
          const recentWindowAcc = Math.round(
            (recentWindow.filter((a: any) => a.correct).length / recentWindow.length) * 100
          );

          // Confidence level
          const confidence = total > 15 ? "high" : total >= 6 ? "medium" : "low";

          // Find all types to determine strongest/weakest
          const { data: allTypes } = await db.from("medical_image_attempts")
            .select("image_type, correct")
            .eq("user_id", userId)
            .not("image_type", "is", null);

          let strongestArea = imgType;
          let weakestArea = imgType;
          if (allTypes && allTypes.length > 0) {
            const byType = new Map<string, { total: number; correct: number }>();
            for (const a of allTypes) {
              const t = (a.image_type || "").toLowerCase();
              if (!t) continue;
              if (!byType.has(t)) byType.set(t, { total: 0, correct: 0 });
              const e = byType.get(t)!;
              e.total++;
              if (a.correct) e.correct++;
            }
            let bestAcc = -1, worstAcc = 101;
            for (const [t, d] of byType) {
              if (d.total < 1) continue;
              const acc = d.correct / d.total;
              if (acc > bestAcc) { bestAcc = acc; strongestArea = t; }
              if (acc < worstAcc) { worstAcc = acc; weakestArea = t; }
            }
          }

          await db.from("visual_skill_snapshots").upsert({
            user_id: userId,
            image_type: imgType,
            attempts_count: total,
            correct_count: correctCount,
            accuracy,
            avg_time_seconds: avgTime,
            score,
            trend,
            confidence_level: confidence,
            recent_window_accuracy: recentWindowAcc,
            strongest_area: strongestArea,
            weakest_area: weakestArea,
            computed_at: now,
            updated_at: now,
          }, { onConflict: "user_id,image_type" });

          effects.visualSkillUpdated = true;
        }
      } catch (e) {
        errors.push(`visual_skill: ${(e as Error).message}`);
      }
    }
    // ── 6. Update daily plan completed count ──
    if (effects.taskCompleted) {
      const { data: plan } = await db.from("daily_plans")
        .select("id, completed_count")
        .eq("user_id", userId).eq("plan_date", today)
        .maybeSingle();
      if (plan) {
        await db.from("daily_plans")
          .update({ completed_count: (plan.completed_count ?? 0) + 1, updated_at: now })
          .eq("id", plan.id);
      }
    }

    // ── Fetch updated state ──
    const [approvalData, pendingReviews, completedToday, planData] = await Promise.all([
      safeQuery<any>(db, (c) =>
        c.from("approval_scores").select("score")
          .eq("user_id", userId).order("created_at", { ascending: false })
          .limit(1).maybeSingle(), "approval"),
      safeQuery<any[]>(db, (c) =>
        c.from("revisoes").select("id")
          .eq("user_id", userId).eq("status", "pendente")
          .lte("data_revisao", today), "pending"),
      safeQuery<any[]>(db, (c) =>
        c.from("daily_plan_tasks").select("id")
          .eq("user_id", userId).eq("completed", true), "completed_today"),
      safeQuery<any>(db, (c) =>
        c.from("daily_plans").select("recovery_mode")
          .eq("user_id", userId).eq("plan_date", today)
          .maybeSingle(), "plan"),
    ]);

    const updatedState = {
      approvalScore: approvalData?.score ?? 0,
      pendingReviews: (pendingReviews ?? []).length,
      completedTasksToday: (completedToday ?? []).length,
      recoveryActive: planData?.recovery_mode ?? false,
    };

    // ── Log decision ──
    await logDecision(db, {
      user_id: userId,
      decision_type: "study_complete",
      source_module: metadata?.originModule ?? "api",
      input_snapshot: { actionType, actionId, taskId, wasCorrect, durationSeconds },
      decision_output: { effects, updatedState, errors },
      justification: `Completed ${actionType}${actionId ? ` (${actionId})` : ""}. ${Object.entries(effects).filter(([,v]) => v).map(([k]) => k).join(", ")}.`,
    });

    return jsonResponse({
      success: errors.length === 0,
      updatedState,
      effects,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("[study-complete]", e);
    return errorResponse(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
