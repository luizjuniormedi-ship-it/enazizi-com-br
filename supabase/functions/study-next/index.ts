/**
 * study-next — API Assistente Phase 1 (v4 — mnemonic adaptive integration)
 * Returns the next recommended study action with weighted justification.
 * Purely deterministic — no AI calls.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery, logDecision,
  logAdaptiveIntervention,
} from "../_shared/assistant-helpers.ts";
import {
  ScoringContext, getApprovalZone,
  scoreReview, scoreFSRS, scoreError, scoreDailyTask, scoreFreeStudy,
  scoreImageQuiz, scoreMnemonic, decideMnemonicMode,
  isVisualTopic, isMnemonicTopic,
  buildJustification, pickDiverseAlternatives,
  buildExplainableJustification,
  type ScoredCandidate, type VisualWeaknessEntry, type MnemonicUtilityEntry,
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

    // ── Reset fence: read user's last_study_plan_reset_at to filter stale items ──
    // Items from before the latest reset must NOT appear as the "current mission",
    // even though they remain in the DB as pedagogical history.
    let resetAt: string | null = null;
    try {
      const { data: rp } = await db
        .from("profiles")
        .select("last_study_plan_reset_at")
        .eq("user_id", userId)
        .maybeSingle();
      resetAt = (rp as any)?.last_study_plan_reset_at ?? null;
    } catch (e) {
      console.warn("[study-next] Reset fence check failed (continuing):", e);
    }

    // ── Parallel data fetch ──
    const [
      pendingReviews, errorBankItems, dailyPlanToday, dailyTasks,
      fsrsDue, approvalData, profile, gamification,
      imageQuizCount, visualAttempts,
      mnemonicFeedbackAgg, mnemonicResultsForUser,
      active_experiments, user_assignments, cognitive_state,
      professorTasks
    ] = await Promise.all([
      safeQuery<any[]>(db, (c) => {
        let q = c.from("revisoes")
          .select("id, tema_id, data_revisao, prioridade, risco_esquecimento, created_at, temas_estudados(tema, especialidade)")
          .eq("user_id", userId).eq("status", "pendente")
          .lte("data_revisao", today);
        // Reset fence: do not surface review items created before the user reset their plan
        if (resetAt) q = q.gt("created_at", resetAt);
        return q.order("prioridade", { ascending: false }).limit(20);
      }, "revisoes"),
      safeQuery<any[]>(db, (c) => {
        let q = c.from("error_bank")
          .select("id, tema, subtema, vezes_errado, categoria_erro, updated_at, dificuldade")
          .eq("user_id", userId).eq("dominado", false);
        // Reset fence: only errors touched after the latest reset count as current journey
        if (resetAt) q = q.gt("updated_at", resetAt);
        return q.order("vezes_errado", { ascending: false }).limit(15);
      }, "error_bank"),
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
      safeQuery<any[]>(db, (c) =>
        c.from("medical_image_questions")
          .select("id")
          .eq("status", "published")
          .limit(1),
        "image_quiz_check"),
      safeQuery<any[]>(db, (c) =>
        c.from("medical_image_attempts")
          .select("correct, image_type, created_at")
          .eq("user_id", userId)
          .not("image_type", "is", null)
          .order("created_at", { ascending: false })
          .limit(200),
        "visual_attempts"),
      // NEW: Mnemonic feedback aggregated by topic for this user
      safeQuery<any[]>(db, (c) =>
        c.from("mnemonic_feedback")
          .select("result_id, utility_score, topic")
          .eq("user_id", userId)
          .not("utility_score", "is", null)
          .order("created_at", { ascending: false })
          .limit(100),
        "mnemonic_feedback"),
      // NEW: Latest mnemonic results per topic for this user
      safeQuery<any[]>(db, (c) =>
        c.from("mnemonic_results")
          .select("id, topic, subtopic, is_latest")
          .eq("user_id", userId)
          .eq("is_latest", true)
          .limit(50),
        "mnemonic_results"),
      safeQuery<any[]>(db, (c) =>
        c.from("adaptive_experiments")
          .select("id, variants")
          .eq("status", "active")
          .limit(10),
        "active_experiments"),
      safeQuery<any[]>(db, (c) =>
        c.from("user_experiment_assignments")
          .select("experiment_id, variant_id")
          .eq("user_id", userId),
        "user_assignments"),
      safeQuery<any>(db, (c) =>
        c.from("adaptive_student_profiles")
          .select("cognitive_stress_index, recovery_mode_active")
          .eq("user_id", userId)
          .maybeSingle(),
        "cognitive_state"),
      safeQuery<any[]>(db, (c) =>
        c.from("professor_plan_daily_tasks")
          .select("id, task_type, task_payload, planned_date")
          .eq("user_id", userId)
          .eq("status", "pending")
          .eq("planned_date", today)
          .order("created_at", { ascending: true })
          .limit(5),
        "professor_tasks"),
    ]);

    const reviews = pendingReviews ?? [];
    const errors = errorBankItems ?? [];
    const fsrsCards = fsrsDue ?? [];
    const tasks = dailyTasks ?? [];
    const approvalScore = approvalData?.score ?? 0;
    const recoveryActive = (dailyPlanToday?.recovery_mode || (cognitive_state as any)?.recovery_mode_active) ?? false;
    const cognitiveStress = (cognitive_state as any)?.cognitive_stress_index ?? 0;
    const contentLocked = dailyPlanToday?.content_lock ?? false;

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

    // ── Aggregate mnemonic utility by topic ──
    const mnemonicUtility: MnemonicUtilityEntry[] = [];
    if (Array.isArray(mnemonicFeedbackAgg) && mnemonicFeedbackAgg.length > 0) {
      const byTopic = new Map<string, { sum: number; count: number; latestResultId?: string }>();
      for (const fb of mnemonicFeedbackAgg) {
        const topic = (fb.topic || "").toLowerCase();
        if (!topic) continue;
        if (!byTopic.has(topic)) byTopic.set(topic, { sum: 0, count: 0 });
        const entry = byTopic.get(topic)!;
        entry.sum += (fb.utility_score ?? 0);
        entry.count++;
        if (!entry.latestResultId && fb.result_id) entry.latestResultId = fb.result_id;
      }
      // Also map latest result IDs from mnemonic_results
      const resultsByTopic = new Map<string, string>();
      if (Array.isArray(mnemonicResultsForUser)) {
        for (const r of mnemonicResultsForUser) {
          if (r.topic) resultsByTopic.set(r.topic.toLowerCase(), r.id);
        }
      }
      for (const [topic, data] of byTopic) {
        mnemonicUtility.push({
          topic,
          avg_utility: Math.round((data.sum / data.count) * 100) / 100,
          feedback_count: data.count,
          latest_result_id: resultsByTopic.get(topic) || data.latestResultId,
        });
      }
    }
    // Also add topics that have results but no feedback yet
    if (Array.isArray(mnemonicResultsForUser)) {
      for (const r of mnemonicResultsForUser) {
        const t = (r.topic || "").toLowerCase();
        if (t && !mnemonicUtility.find(u => u.topic === t)) {
          mnemonicUtility.push({
            topic: t,
            avg_utility: 0,
            feedback_count: 0,
            latest_result_id: r.id,
          });
        }
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
      mnemonicUtility,
    };

    // ── Classify errors ──
    const visualErrors = errors.filter((e: any) => isVisualTopic(e.tema, e.subtema));
    const mnemonicErrors = errors.filter((e: any) =>
      isMnemonicTopic(e.tema, e.subtema) && (e.vezes_errado ?? 0) >= 2
    );

    // ── Also include ANY topic with 3+ errors as mnemonic-eligible ──
    // (even if it doesn't match mnemonic patterns, high error count = needs memory help)
    for (const err of errors) {
      if ((err.vezes_errado ?? 0) >= 3 &&
          !mnemonicErrors.find((m: any) => m.tema === err.tema)) {
        mnemonicErrors.push(err);
      }
    }

    // ── Consecutive error detection ──
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
      // Build human-friendly title/description for FSRS cards (Bug A Fix)
      const topic = card.card_type === "tema" ? "esse tema" : "esses flashcards";
      
      let fsrsTitle = "Retomar conhecimento";
      let fsrsDescription = "Seu cérebro está prestes a esquecer este conteúdo. Vamos revisar agora?";

      if (card.stability === 0 || (card.reps || 0) === 0) {
        fsrsTitle = "Iniciar novo conteúdo";
        fsrsDescription = "Você tem conteúdos novos para começar hoje. Bora iniciar!";
      } else if (card.lapses > 2) {
        fsrsTitle = "Revisão Crítica";
        fsrsDescription = `Você está esquecendo "${topic}". O ACE priorizou esta revisão urgente.`;
      } else if (fsrsCards.length > 5) {
        fsrsTitle = "Sessão de Fixação";
        fsrsDescription = `${fsrsCards.length} revisões pendentes hoje. Vamos garantir sua retenção!`;
      }

      candidates.push({
        type: "review",
        title: fsrsTitle,
        description: fsrsDescription,
        targetId: card.id,
        targetType: "fsrs_card",
        estimatedMinutes: 5,
        priorityScore: scoreFSRS(card, ctx),
        // Preserve technical data in context but never show to user directly
        contextPayload: {
          original_card_type: card.card_type,
          original_lapses: card.lapses,
          original_stability: card.stability,
          original_reps: card.reps
        }
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

    // ── Image Quiz candidate ──
    const visualSnapshots = await safeQuery<any[]>(db, (c) =>
      c.from("visual_skill_snapshots")
        .select("image_type, accuracy, score, trend, weakest_area, attempts_count")
        .eq("user_id", userId)
        .order("accuracy", { ascending: true })
        .limit(10),
      "visual_snapshots");

    const imgResult = scoreImageQuiz(visualErrors, ctx);
    if (imgResult.score > 0) {
      const topic = imgResult.bestTopic;
      let targetType = imgResult.targetImageType;

      if (!targetType && Array.isArray(visualSnapshots) && visualSnapshots.length > 0) {
        const weakSnap = visualSnapshots.find((s: any) => s.accuracy < 70 && s.attempts_count >= 1);
        if (weakSnap) targetType = weakSnap.image_type;
      }

      const IMAGE_TYPE_NAMES: Record<string, string> = {
        ecg: "ECG", xray: "RX de Tórax", ct: "Tomografia", us: "Ultrassom",
        dermatology: "Dermatologia", pathology: "Patologia", ophthalmology: "Oftalmologia",
      };
      const typeName = targetType ? (IMAGE_TYPE_NAMES[targetType] || targetType.toUpperCase()) : null;

      const imgTitle = typeName
        ? `Treino visual: ${typeName}`
        : topic
          ? `Treino visual: ${topic.tema}`
          : "Treino de interpretação visual";

      let imgDescription: string;
      if (targetType && typeName) {
        const snap = Array.isArray(visualSnapshots)
          ? visualSnapshots.find((s: any) => s.image_type === targetType)
          : null;
        const acc = snap?.accuracy;
        const trend = snap?.trend;
        if (acc !== undefined) {
          if (trend === "declining") {
            imgDescription = `Seu desempenho em ${typeName} está piorando (${acc}% de acerto) → hora de reforçar.`;
          } else if (trend === "improving" && acc > 70) {
            imgDescription = `Você melhorou em ${typeName} (${acc}%), então vamos subir o nível.`;
          } else if (acc < 50) {
            imgDescription = `Você está fraco em ${typeName} (${acc}% de acerto) → vamos treinar agora.`;
          } else {
            imgDescription = `Seu desempenho em ${typeName} (${acc}%) pode melhorar → vamos praticar.`;
          }
        } else {
          imgDescription = `Seu desempenho em ${typeName} precisa de reforço. Vamos treinar com questões de imagem.`;
        }
      } else if (topic) {
        imgDescription = `Você vem errando interpretação de ${topic.tema}${topic.subtema ? ` (${topic.subtema})` : ""}. Vamos reforçar com questões de imagem.`;
      } else {
        imgDescription = "Treino adaptativo de interpretação de imagens médicas.";
      }

      let imgScore = imgResult.score;
      if (consecutiveErrorBoost) imgScore = Math.min(150, imgScore + 20);
      const snapForPayload = Array.isArray(visualSnapshots)
        ? visualSnapshots.find((s: any) => s.image_type === targetType)
        : null;
      candidates.push({
        type: "image_quiz",
        title: imgTitle,
        description: imgDescription,
        targetType: "image_quiz",
        estimatedMinutes: 8,
        priorityScore: imgScore,
        contextPayload: {
          topic: topic?.tema,
          subtopic: topic?.subtema,
          errorCount: topic?.vezes_errado,
          imageType: targetType,
          consecutiveErrorBoost,
          accuracy: snapForPayload?.accuracy,
          trend: snapForPayload?.trend,
          adaptiveDifficulty: snapForPayload?.trend === "declining" || (snapForPayload?.accuracy ?? 100) < 50
            ? "easy"
            : (snapForPayload?.accuracy ?? 0) > 75 && snapForPayload?.trend === "improving"
              ? "hard"
              : undefined,
        },
      });
    }

    // ── Mnemonic candidate (enhanced with utility + mode decision) ──
    const mnemResult = scoreMnemonic(mnemonicErrors, ctx);
    if (mnemResult.score > 0 && mnemResult.bestTopic) {
      const topic = mnemResult.bestTopic;
      let mnemScore = mnemResult.score;
      if (consecutiveErrorBoost) mnemScore = Math.min(150, mnemScore + 20);

      // Decide mode: review_existing, regenerate, or create_new
      const decision = decideMnemonicMode(
        topic.tema,
        mnemonicUtility,
        topic.categoria_erro,
      );

      // Build adaptive title and description based on mode
      let title: string;
      let description: string;

      switch (decision.mode) {
        case "review_existing":
          title = `Fixar com mnemônico: ${topic.tema}`;
          description = decision.utilityScore && decision.utilityScore > 0
            ? `O mnemônico de "${topic.tema}" está ajudando — revise para consolidar a memória.`
            : `Você já errou "${topic.tema}" ${topic.vezes_errado}x. Revise o mnemônico para reforçar.`;
          break;
        case "regenerate":
          title = `Novo mnemônico: ${topic.tema}`;
          const styleLabel = decision.preferredStyle === "visual" ? "mais visual"
            : decision.preferredStyle === "engraçado" ? "mais engraçado"
            : decision.preferredStyle === "acadêmico" ? "mais acadêmico"
            : decision.preferredStyle === "curto" ? "mais curto"
            : "diferente";
          description = `O mnemônico atual de "${topic.tema}" não está funcionando bem. Gere uma versão ${styleLabel}.`;
          break;
        case "create_new":
          title = `Criar mnemônico: ${topic.tema}`;
          description = `Você erra "${topic.tema}" com frequência (${topic.vezes_errado}x). Um mnemônico visual pode ajudar a fixar.`;
          break;
      }

      candidates.push({
        type: "mnemonic",
        title,
        description,
        targetType: "mnemonic",
        estimatedMinutes: 5,
        priorityScore: mnemScore,
        contextPayload: {
          topic: topic.tema,
          subtopic: topic.subtema,
          errorCount: topic.vezes_errado,
          errorCategory: topic.categoria_erro,
          consecutiveErrorBoost,
          mnemonicMode: decision.mode,
          preferredStyle: decision.preferredStyle,
          resultId: decision.resultId,
          utilityScore: decision.utilityScore,
        },
      });
    }

    // Free-study fallback
    candidates.push({
      type: "free_study",
      title: "Estudo livre",
      description: "Sem tarefas pendentes. Explore novos temas ou pratique questões.",
      estimatedMinutes: 20,
      priorityScore: scoreFreeStudy(ctx),
    });

    // ── Cognitive Fatigue Recovery Logic ──
    if (cognitiveStress > 0.8 || recoveryActive) {
      // Penalize pro-active/heavy interventions when stress is high
      candidates.forEach(c => {
        if (c.type === 'mnemonic' || c.type === 'image_quiz') {
          c.priorityScore *= 0.7; // 30% reduction for heavy cognitive tasks
        }
        if (c.type === 'free_study') {
          c.priorityScore *= 1.2; // Favor free exploration
        }
      });
    }

    // ── Adaptive Experimentation Assignment ──
    const activeExps = (active_experiments as any) || [];
    const userAss = new Map((user_assignments as any[] || []).map(a => [a.experiment_id, a.variant_id]));
    
    // ── Sort and pick ──
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    let recommendation = candidates[0];
    
    // Assign user to active experiments if they match the trigger
    for (const exp of activeExps) {
      if (!userAss.has(exp.id)) {
        // Simple random assignment for A/B (deterministic-ish)
        const variants = exp.variants as any[];
        const variant = variants[Math.floor(Math.random() * variants.length)];
        
        // Fire-and-forget assignment
        db.from("user_experiment_assignments").insert({
          user_id: userId,
          experiment_id: exp.id,
          variant_id: variant.id
        }).then(() => {});
        
        userAss.set(exp.id, variant.id);
      }
    }

    // Redefinição removida para evitar conflito de identificador
    const alternativeActions = pickDiverseAlternatives(candidates, recommendation.type);

    // ── Justification ──
    const counts = {
      reviews: reviews.length, fsrs: fsrsCards.length, errors: errors.length,
      tasks: tasks.length,
      visualErrors: visualErrors.length,
      mnemonicCandidates: mnemonicErrors.length,
    };

    const justification = buildJustification(counts, ctx, recommendation.type);

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
      mnemonicUtilityTopics: mnemonicUtility.length,
      justification: buildExplainableJustification(counts, ctx, recommendation.type),
    };

    // ── Telemetry ──
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
            mnemonic_mode: recommendation.type === "mnemonic"
              ? (recommendation.contextPayload as any)?.mnemonicMode
              : undefined,
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
        mnemonicUtilityTopics: mnemonicUtility.length,
      },
      decision_output: {
        recommendation: recommendation.type, title: recommendation.title,
        priorityScore: recommendation.priorityScore,
        alternatives: alternativeActions.length,
        approvalZone: ctx.approvalZone,
        mnemonicMode: recommendation.type === "mnemonic"
          ? (recommendation.contextPayload as any)?.mnemonicMode
          : undefined,
      },
      justification,
      confidence_score: recommendation.priorityScore,
    });

    // ── Closed Loop: Log as Adaptive Intervention with Policy Governance ──
    if (recommendation.priorityScore > 80) {
      try {
        // Find matching policy (Heuristic for edge)
        const { data: policies } = await db
          .from("intervention_policies")
          .select("id, severity_level, min_confidence_score")
          .eq("trigger_type", recommendation.type)
          .eq("is_active", true);
        
        const policy = policies?.[0];
        const confidence = (recommendation.priorityScore || 0) / 150;

        if (!policy || confidence >= (policy.min_confidence_score || 0.7)) {
          await logAdaptiveIntervention(db, {
            user_id: userId,
            trigger_type: recommendation.type,
            action_taken: recommendation.title,
            policy_id: policy?.id,
            severity: policy?.severity_level || 'low',
            confidence_score: confidence,
            evidence_score: (errors.length + reviews.length) / 20, // Proxy for evidence
            friction_score_snapshot: Math.max(0, (150 - (recommendation.priorityScore || 0)) / 150),
            recommendation_text: justification,
            action_payload: (recommendation.contextPayload || {}) as Record<string, unknown>,
            status: 'pending',
          });
        } else {
          // Log block by governance
          await db.from("adaptive_governance_logs").insert({
            user_id: userId,
            policy_id: policy.id,
            action_type: 'intervention_blocked',
            reason: `Confidence score ${confidence.toFixed(2)} below threshold ${policy.min_confidence_score}`,
            metadata: { recommendation: recommendation.title }
          });
        }
      } catch (e) {
        console.warn("[study-next] Governance loop failed:", e);
      }
    }

    // ── Engine V3 snapshot — fire-and-forget for impact observability ──
    // Persists in assistant_decisions with source_module='study-engine-v3'
    // so useStudyEngineImpact can read real boost data from the edge.
    try {
      const examMultiplier = examProximityDays === null
        ? 1.0
        : examProximityDays < 30 ? 1.6
        : examProximityDays < 60 ? 1.3
        : 1.0;

      const hasCriticalGaps = errors.length > 0 || reviews.length > 0;
      const top5 = candidates.slice(0, 5).map((c) => {
        // Heuristic boost detection — edge can't compute the full coverage engine,
        // but it can flag the same signals the client engine reads.
        const isReview = c.type === "review" || c.type === "error_review";
        return {
          topic: (c.contextPayload as any)?.topic ?? c.title,
          type: c.type,
          base_priority: c.priorityScore,
          final_priority: c.priorityScore,
          boosted_by_coverage: hasCriticalGaps && isReview,
          boosted_by_goal: false, // computed client-side; edge cannot see monthly goal
          boosted_by_exam_pressure: examProximityDays !== null && examProximityDays < 30,
        };
      });

      const totals = top5.reduce(
        (acc, r) => {
          if (r.boosted_by_coverage) acc.coverageBoosts++;
          if (r.boosted_by_goal) acc.goalBoosts++;
          if (r.boosted_by_exam_pressure) acc.examPressureBoosts++;
          return acc;
        },
        { coverageBoosts: 0, goalBoosts: 0, examPressureBoosts: 0 }
      );

      // Don't await — fire-and-forget so we never block the response.
      db.from("assistant_decisions").insert([{
        user_id: userId,
        source_module: "study-engine-v3",
        decision_type: "engine_snapshot",
        justification: "Study Engine V3 edge snapshot",
        confidence_score: null,
        input_snapshot: {
          exam_date: profile?.exam_date ?? null,
          days_to_exam: examProximityDays,
          coverage_pct: null, // computed client-side
          monthly_questions_30d: null,
          monthly_backlog: null,
          daily_question_target: null,
          pace_status: null,
          exam_multiplier: examMultiplier,
        },
        decision_output: {
          engine_version: "v3",
          source: "edge",
          top_recommendations: top5,
          boost_totals: totals,
        },
      }]).then(({ error }) => {
        if (error) console.warn("[study-next] V3 snapshot insert failed:", error.message);
      });
    } catch (e) {
      console.warn("[study-next] V3 snapshot skipped:", e);
    }

    return jsonResponse({
      success: true,
      data: {
        recommendation,
        justification,
        alternativeActions,
        adaptiveState,
      }
    });
  } catch (err: any) {
    console.error("[study-next]", err);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
