/**
 * study-next — API Assistente Phase 1 (v2 — composite scoring)
 * Returns the next recommended study action with weighted justification.
 * Purely deterministic — no AI calls.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery, logDecision,
} from "../_shared/assistant-helpers.ts";
import {
  ScoringContext, getApprovalZone,
  scoreReview, scoreFSRS, scoreError, scoreDailyTask, scoreFreeStudy,
  buildJustification, pickDiverseAlternatives,
  type ScoredCandidate,
} from "../_shared/study-next-scoring.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const context = body.context ?? {};
    const db = getServiceClient();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // ── Parallel data fetch ──
    const [
      pendingReviews, errorBankItems, dailyPlanToday, dailyTasks,
      fsrsDue, approvalData, profile, gamification,
    ] = await Promise.all([
      safeQuery<any[]>(db, (c) =>
        c.from("revisoes")
          .select("id, tema_id, data_revisao, prioridade, risco_esquecimento, temas_estudados(tema, especialidade)")
          .eq("user_id", userId).eq("status", "pendente")
          .lte("data_revisao", today)
          .order("prioridade", { ascending: false }).limit(20),
        "revisoes"),
      safeQuery<any[]>(db, (c) =>
        c.from("error_bank")
          .select("id, tema, subtema, vezes_errado, categoria_erro, updated_at")
          .eq("user_id", userId).eq("dominado", false)
          .order("vezes_errado", { ascending: false }).limit(15),
        "error_bank"),
      safeQuery<any>(db, (c) =>
        c.from("daily_plans")
          .select("id, plan_json, completed_count, total_blocks, recovery_mode, content_lock, phase")
          .eq("user_id", userId).eq("plan_date", today)
          .maybeSingle(),
        "daily_plan"),
      safeQuery<any[]>(db, (c) =>
        c.from("daily_plan_tasks")
          .select("id, title, task_type, specialty, topic, subtopic, completed, priority, estimated_minutes")
          .eq("user_id", userId).eq("completed", false)
          .order("priority", { ascending: false }).limit(20),
        "daily_tasks"),
      safeQuery<any[]>(db, (c) =>
        c.from("fsrs_cards")
          .select("id, card_type, card_ref_id, stability, difficulty, state, due, lapses")
          .eq("user_id", userId).lte("due", now)
          .order("due", { ascending: true }).limit(20),
        "fsrs"),
      safeQuery<any>(db, (c) =>
        c.from("approval_scores")
          .select("score, prep_index, chance_score, phase")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(1)
          .maybeSingle(),
        "approval"),
      safeQuery<any>(db, (c) =>
        c.from("profiles")
          .select("exam_date, target_exam")
          .eq("user_id", userId).maybeSingle(),
        "profile"),
      safeQuery<any>(db, (c) =>
        c.from("user_gamification")
          .select("current_streak")
          .eq("user_id", userId).maybeSingle(),
        "gamification"),
    ]);

    const reviews = pendingReviews ?? [];
    const errors = errorBankItems ?? [];
    const fsrsCards = fsrsDue ?? [];
    const tasks = dailyTasks ?? [];
    const approvalScore = approvalData?.score ?? 0;
    const recoveryActive = dailyPlanToday?.recovery_mode ?? false;
    const contentLocked = dailyPlanToday?.content_lock ?? false;

    // ── Exam proximity ──
    let examProximityDays: number | null = null;
    if (profile?.exam_date) {
      const diff = (new Date(profile.exam_date).getTime() - Date.now()) / 86_400_000;
      if (diff > 0) examProximityDays = Math.round(diff);
    }

    // ── Build scoring context ──
    const ctx: ScoringContext = {
      approvalScore,
      approvalZone: getApprovalZone(approvalScore),
      recoveryActive,
      contentLocked,
      missionActive: context.missionActive ?? false,
      sessionMinutes: context.sessionDurationMinutes ?? null,
      examProximityDays,
      now,
      today,
    };

    // ── Score all candidates ──
    const candidates: ScoredCandidate[] = [];

    for (const rev of reviews.slice(0, 8)) {
      const tema = rev.temas_estudados?.tema ?? "Revisão";
      const spec = rev.temas_estudados?.especialidade ?? "";
      candidates.push({
        type: "review",
        title: `Revisar: ${tema}`,
        description: `Revisão pendente${spec ? ` — ${spec}` : ""}. Prioridade ${rev.prioridade ?? "normal"}.`,
        targetId: rev.id,
        targetType: "revisao",
        estimatedMinutes: 10,
        priorityScore: scoreReview(rev, ctx),
      });
    }

    for (const card of fsrsCards.slice(0, 5)) {
      candidates.push({
        type: "review",
        title: `FSRS: ${card.card_type} (lapsos: ${card.lapses})`,
        description: `Card de repetição espaçada vencido. Estabilidade: ${card.stability?.toFixed(1)}.`,
        targetId: card.id,
        targetType: "fsrs_card",
        estimatedMinutes: 5,
        priorityScore: scoreFSRS(card, ctx),
      });
    }

    for (const err of errors.slice(0, 5)) {
      candidates.push({
        type: "error_review",
        title: `Corrigir erro: ${err.tema}`,
        description: `Errado ${err.vezes_errado}x${err.subtema ? ` — ${err.subtema}` : ""}. ${err.categoria_erro ?? ""}`,
        targetId: err.id,
        targetType: "error_bank",
        estimatedMinutes: 15,
        priorityScore: scoreError(err, ctx),
      });
    }

    for (const task of tasks.slice(0, 8)) {
      candidates.push({
        type: "daily_task",
        title: task.title,
        description: `Tarefa do plano diário${task.specialty ? ` — ${task.specialty}` : ""}.`,
        targetId: task.id,
        targetType: "daily_plan_task",
        estimatedMinutes: task.estimated_minutes ?? 15,
        priorityScore: scoreDailyTask(task, ctx),
      });
    }

    // Free-study fallback candidate
    candidates.push({
      type: "free_study",
      title: "Estudo livre",
      description: "Sem tarefas pendentes. Explore novos temas ou pratique questões.",
      estimatedMinutes: 20,
      priorityScore: scoreFreeStudy(ctx),
    });

    // ── Sort and pick ──
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    const recommendation = candidates[0];
    const alternativeActions = pickDiverseAlternatives(candidates, recommendation.type);

    // ── Justification ──
    const justification = buildJustification(
      { reviews: reviews.length, fsrs: fsrsCards.length, errors: errors.length, tasks: tasks.length },
      ctx,
      recommendation.type,
    );

    const adaptiveState = {
      approvalScore,
      approvalZone: ctx.approvalZone,
      recoveryActive,
      contentLocked,
      pendingReviews: reviews.length + fsrsCards.length,
      weakTopicsCount: new Set(errors.map((e: any) => e.tema)).size,
      examProximityDays,
    };

    // ── Log decision ──
    await logDecision(db, {
      user_id: userId,
      decision_type: "study_next",
      source_module: context.currentModule ?? "api",
      input_snapshot: {
        pendingReviews: reviews.length, errors: errors.length,
        fsrs: fsrsCards.length, tasks: tasks.length,
        approvalScore, recoveryActive, contentLocked,
        examProximityDays, sessionMinutes: ctx.sessionMinutes,
      },
      decision_output: {
        recommendation: recommendation.type, title: recommendation.title,
        priorityScore: recommendation.priorityScore,
        alternatives: alternativeActions.length,
        approvalZone: ctx.approvalZone,
      },
      justification,
      confidence_score: recommendation.priorityScore,
    });

    return jsonResponse({
      success: true,
      recommendation,
      justification,
      alternativeActions,
      adaptiveState,
    });
  } catch (e) {
    console.error("[study-next]", e);
    return errorResponse(e instanceof Error ? e.message : "Erro interno", 500);
  }
});
