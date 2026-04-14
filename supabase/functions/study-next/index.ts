/**
 * study-next — API Assistente Phase 1 (v3 — composite scoring + image_quiz + mnemonic)
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
  scoreImageQuiz, scoreMnemonic,
  isVisualTopic, isMnemonicTopic,
  buildJustification, pickDiverseAlternatives,
  type ScoredCandidate, type VisualWeaknessEntry,
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

    // ── Parallel data fetch (existing + new image quiz count) ──
    const [
      pendingReviews, errorBankItems, dailyPlanToday, dailyTasks,
      fsrsDue, approvalData, profile, gamification,
      imageQuizCount, visualAttempts,
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
      // NEW: check if published image quiz questions exist (lightweight)
      safeQuery<any[]>(db, (c) =>
        c.from("medical_image_questions")
          .select("id")
          .eq("status", "published")
          .limit(1),
        "image_quiz_check"),
      // NEW: visual weakness data from real attempts
      safeQuery<any[]>(db, (c) =>
        c.from("medical_image_attempts")
          .select("correct, image_type, created_at")
          .eq("user_id", userId)
          .not("image_type", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
        "visual_attempts"),
    ]);

    const reviews = pendingReviews ?? [];
    const errors = errorBankItems ?? [];
    const fsrsCards = fsrsDue ?? [];
    const tasks = dailyTasks ?? [];
    const approvalScore = approvalData?.score ?? 0;
    const recoveryActive = dailyPlanToday?.recovery_mode ?? false;
    const contentLocked = dailyPlanToday?.content_lock ?? false;

    // Image quiz availability — check if any published questions exist
    const imgQuizAvailable = Array.isArray(imageQuizCount) ? imageQuizCount.length : 0;

    // ── Exam proximity ──
    let examProximityDays: number | null = null;
    if (profile?.exam_date) {
      const diff = (new Date(profile.exam_date).getTime() - Date.now()) / 86_400_000;
      if (diff > 0) examProximityDays = Math.round(diff);
    }

    // ── Compute visual weakness from real attempts ──
    const visualWeaknesses: VisualWeaknessEntry[] = [];
    if (Array.isArray(visualAttempts) && visualAttempts.length > 0) {
      const byType = new Map<string, { total: number; correct: number; dates: number[] }>();
      for (const a of visualAttempts) {
        const t = (a.image_type || "").toLowerCase();
        if (!t) continue;
        if (!byType.has(t)) byType.set(t, { total: 0, correct: 0, dates: [] });
        const entry = byType.get(t)!;
        entry.total++;
        if (a.correct) entry.correct++;
        entry.dates.push(new Date(a.created_at).getTime());
      }
      for (const [imageType, data] of byType) {
        const accuracy = Math.round((data.correct / data.total) * 100);
        // Simple trend: compare first half vs second half
        let trend: "improving" | "declining" | "stable" = "stable";
        if (data.total >= 10) {
          const mid = Math.floor(data.total / 2);
          const sorted = [...visualAttempts.filter((a: any) => (a.image_type || "").toLowerCase() === imageType)];
          const recentCorrect = sorted.slice(0, mid).filter((a: any) => a.correct).length;
          const olderCorrect = sorted.slice(mid).filter((a: any) => a.correct).length;
          const recentAcc = recentCorrect / mid;
          const olderAcc = olderCorrect / (data.total - mid);
          if (recentAcc - olderAcc > 0.1) trend = "improving";
          else if (recentAcc - olderAcc < -0.1) trend = "declining";
        }
        visualWeaknesses.push({ imageType, accuracy, attemptsCount: data.total, trend });
      }
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
      imageQuizAvailable: imgQuizAvailable,
      visualWeaknesses,
    };

    // ── Classify errors by type for new scorers ──
    const visualErrors = errors.filter((e: any) => isVisualTopic(e.tema, e.subtema));
    const mnemonicErrors = errors.filter((e: any) =>
      isMnemonicTopic(e.tema, e.subtema) && (e.vezes_errado ?? 0) >= 2
    );

    // ── Consecutive error detection (2+ errors in a row → force review + quiz + mnemonic) ──
    let consecutiveErrorBoost = false;
    if (errors.length >= 2) {
      const sorted = [...errors].sort((a: any, b: any) =>
        new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
      );
      const top2 = sorted.slice(0, 2);
      const recentEnough = top2.every((e: any) => {
        const d = (Date.now() - new Date(e.updated_at || 0).getTime()) / 86_400_000;
        return d <= 2;
      });
      if (recentEnough && top2.every((e: any) => (e.vezes_errado ?? 0) >= 2)) {
        consecutiveErrorBoost = true;
      }
    }

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

    // ── Image Quiz candidate (enhanced with real visual weakness) ──
    const imgResult = scoreImageQuiz(visualErrors, ctx);
    if (imgResult.score > 0) {
      const topic = imgResult.bestTopic;
      const targetType = imgResult.targetImageType;
      const title = targetType
        ? `Treino visual: ${targetType.toUpperCase()}`
        : topic
          ? `Treino visual: ${topic.tema}`
          : "Treino de interpretação visual";
      const description = targetType
        ? `Seu desempenho em ${targetType.toUpperCase()} precisa de reforço. Vamos treinar com questões de imagem.`
        : topic
          ? `Você vem errando interpretação de ${topic.tema}${topic.subtema ? ` (${topic.subtema})` : ""}. Vamos reforçar com questões de imagem.`
          : "Treino adaptativo de interpretação de imagens médicas.";
      let imgScore = imgResult.score;
      if (consecutiveErrorBoost) imgScore = Math.min(150, imgScore + 20);
      candidates.push({
        type: "image_quiz",
        title,
        description,
        targetType: "image_quiz",
        estimatedMinutes: 8,
        priorityScore: imgScore,
        contextPayload: {
          topic: topic?.tema,
          subtopic: topic?.subtema,
          errorCount: topic?.vezes_errado,
          imageType: targetType,
          consecutiveErrorBoost,
        },
      });
    }

    // ── Mnemonic candidate ──
    const mnemResult = scoreMnemonic(mnemonicErrors, ctx);
    if (mnemResult.score > 0 && mnemResult.bestTopic) {
      const topic = mnemResult.bestTopic;
      let mnemScore = mnemResult.score;
      if (consecutiveErrorBoost) mnemScore = Math.min(150, mnemScore + 20);
      candidates.push({
        type: "mnemonic",
        title: `Fixar com mnemônico: ${topic.tema}`,
        description: `Você já errou "${topic.tema}" ${topic.vezes_errado}x. Um mnemônico pode ajudar a consolidar.`,
        targetType: "mnemonic",
        estimatedMinutes: 5,
        priorityScore: mnemScore,
        contextPayload: {
          topic: topic.tema,
          subtopic: topic.subtema,
          errorCount: topic.vezes_errado,
          errorCategory: topic.categoria_erro,
          consecutiveErrorBoost,
        },
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
      {
        reviews: reviews.length, fsrs: fsrsCards.length, errors: errors.length,
        tasks: tasks.length,
        visualErrors: visualErrors.length,
        mnemonicCandidates: mnemonicErrors.length,
      },
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
      visualWeaknesses: visualErrors.length,
      mnemonicCandidates: mnemonicErrors.length,
      imageQuizAvailable: imgQuizAvailable,
      consecutiveErrorBoost,
    };

    // ── Telemetry: log visual recommendations and consecutive error triggers ──
    if (recommendation.type === "image_quiz" || recommendation.type === "mnemonic" || consecutiveErrorBoost) {
      try {
        await db.from("automation_telemetry").insert({
          event_type: consecutiveErrorBoost ? "consecutive_error_boost" : `recommendation_${recommendation.type}`,
          module: "study-next",
          details: {
            recommendation_type: recommendation.type,
            priority_score: recommendation.priorityScore,
            visual_errors: visualErrors.length,
            mnemonic_candidates: mnemonicErrors.length,
            consecutive_boost: consecutiveErrorBoost,
          },
          user_id: userId,
        });
      } catch { /* non-critical */ }
    }

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
        visualErrors: visualErrors.length,
        mnemonicCandidates: mnemonicErrors.length,
        imageQuizAvailable: imgQuizAvailable,
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
