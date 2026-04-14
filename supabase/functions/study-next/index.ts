/**
 * study-next — API Assistente Phase 1
 * Returns the next recommended study action with justification.
 * Mirrors studyEngine.ts logic server-side.
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
    const body = await req.json().catch(() => ({}));
    const context = body.context ?? {};
    const db = getServiceClient();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // ── Parallel data fetch ──
    const [
      pendingReviews,
      errorBankItems,
      dailyPlanToday,
      dailyTasks,
      fsrsDue,
      approvalData,
      profile,
      gamification,
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
          .select("id, tema, subtema, vezes_errado, categoria_erro")
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
    const pendingCount = reviews.length + fsrsCards.length;

    // ── Weak topics from error bank ──
    const weakTopics = new Set(errors.map((e: any) => e.tema));

    // ── Priority logic (mirrors studyEngine.ts) ──
    type Recommendation = {
      type: string; title: string; description: string;
      targetId?: string; targetType?: string;
      estimatedMinutes: number; priorityScore: number;
    };
    const candidates: Recommendation[] = [];

    // 1. Pending reviews (highest priority)
    for (const rev of reviews.slice(0, 5)) {
      const tema = rev.temas_estudados?.tema ?? "Revisão";
      const spec = rev.temas_estudados?.especialidade ?? "";
      const priority = Math.min(100, (rev.prioridade ?? 50) + (rev.risco_esquecimento ?? 0) * 10);
      candidates.push({
        type: "review", title: `Revisar: ${tema}`,
        description: `Revisão pendente${spec ? ` — ${spec}` : ""}. Prioridade ${rev.prioridade ?? "normal"}.`,
        targetId: rev.id, targetType: "revisao",
        estimatedMinutes: 10, priorityScore: priority,
      });
    }

    // 2. FSRS due cards
    for (const card of fsrsCards.slice(0, 3)) {
      candidates.push({
        type: "review", title: `FSRS: ${card.card_type} (lapsos: ${card.lapses})`,
        description: `Card de repetição espaçada vencido. Estabilidade: ${card.stability?.toFixed(1)}.`,
        targetId: card.id, targetType: "fsrs_card",
        estimatedMinutes: 5, priorityScore: 85 + Math.min(card.lapses * 2, 10),
      });
    }

    // 3. Recurring errors
    for (const err of errors.slice(0, 3)) {
      const priority = 70 + Math.min(err.vezes_errado * 5, 25);
      candidates.push({
        type: "error_review", title: `Corrigir erro: ${err.tema}`,
        description: `Errado ${err.vezes_errado}x${err.subtema ? ` — ${err.subtema}` : ""}. ${err.categoria_erro ?? ""}`,
        targetId: err.id, targetType: "error_bank",
        estimatedMinutes: 15, priorityScore: priority,
      });
    }

    // 4. Daily plan tasks
    for (const task of tasks.slice(0, 5)) {
      const priority = task.priority === "high" ? 65 : task.priority === "medium" ? 55 : 45;
      candidates.push({
        type: "daily_task", title: task.title,
        description: `Tarefa do plano diário${task.specialty ? ` — ${task.specialty}` : ""}.`,
        targetId: task.id, targetType: "daily_plan_task",
        estimatedMinutes: task.estimated_minutes ?? 15, priorityScore: priority,
      });
    }

    // Sort by priority
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    const recommendation = candidates[0] ?? {
      type: "free_study", title: "Estudo livre",
      description: "Sem tarefas pendentes. Explore novos temas ou pratique questões.",
      estimatedMinutes: 20, priorityScore: 0,
    };

    const alternativeActions = candidates.slice(1, 4);

    // ── Build justification ──
    let justification = "";
    if (reviews.length > 0) justification = `Você tem ${reviews.length} revisão(ões) pendente(s). `;
    if (fsrsCards.length > 0) justification += `${fsrsCards.length} card(s) FSRS vencido(s). `;
    if (errors.length > 0) justification += `${errors.length} erro(s) recorrente(s) no banco. `;
    if (recoveryActive) justification += "Modo recuperação ativo — carga reduzida. ";
    if (contentLocked) justification += "Conteúdo novo bloqueado até limpar revisões. ";
    if (!justification) justification = "Nenhuma pendência crítica. Estudo livre recomendado.";

    const adaptiveState = {
      approvalScore,
      recoveryActive,
      contentLocked,
      pendingReviews: pendingCount,
      weakTopicsCount: weakTopics.size,
    };

    // ── Log decision ──
    await logDecision(db, {
      user_id: userId,
      decision_type: "study_next",
      source_module: context.currentModule ?? "api",
      input_snapshot: { pendingReviews: reviews.length, errors: errors.length, fsrs: fsrsCards.length, tasks: tasks.length, approvalScore },
      decision_output: { recommendation: recommendation.type, title: recommendation.title, priorityScore: recommendation.priorityScore, alternatives: alternativeActions.length },
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
