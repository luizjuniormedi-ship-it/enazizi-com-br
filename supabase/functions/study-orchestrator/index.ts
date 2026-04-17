/**
 * study-orchestrator — F1 (shadow mode)
 *
 * Central pedagogical orchestrator. Collects signals, applies 8 weighted rules,
 * picks the next action and logs EVERYTHING (final decision + rule trace + scores)
 * into assistant_decisions. Shadow mode: response is returned but UI consumption
 * is opt-in (frontend keeps study-next as fallback).
 *
 * NEVER throws upstream — always returns a safe study_session fallback.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery, logDecision,
} from "../_shared/assistant-helpers.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirrored from src/types/orchestrator.ts — keep in sync)
// ─────────────────────────────────────────────────────────────────────────────
type OrchestratorAction =
  | "study_session" | "review_fsrs" | "error_review" | "tutor" | "mnemonic"
  | "image_quiz" | "simulado" | "clinical_case" | "planner_rebuild" | "reinforcement";

interface RuleTrace {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  weight: number;
  signals: Record<string, number | string | boolean | null>;
  notes?: string;
}

interface OrchestratorPayload {
  topic?: string; subtopic?: string; specialty?: string;
  errorId?: string; resultId?: string;
  mnemonicMode?: "review_existing" | "regenerate" | "create_new";
  tutorPhase?: string; difficulty?: string; imageType?: string;
  [k: string]: string | number | boolean | undefined;
}

interface Recommendation {
  nextAction: OrchestratorAction;
  targetModule: string;
  executionMode: "inline" | "navigate" | "drawer";
  priority: number;
  reason: string;
  cta: string;
  payload: OrchestratorPayload;
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing table — single source of truth for nextAction → module/CTA
// ─────────────────────────────────────────────────────────────────────────────
const ACTION_META: Record<OrchestratorAction, { route: string; mode: "inline" | "navigate" | "drawer"; cta: string }> = {
  study_session:   { route: "/dashboard/quiz",         mode: "inline",   cta: "Começar sessão guiada" },
  review_fsrs:     { route: "/dashboard/revisao",      mode: "navigate", cta: "Fazer revisões pendentes" },
  error_review:    { route: "/dashboard/banco-erros",  mode: "navigate", cta: "Revisar erros recorrentes" },
  tutor:           { route: "/dashboard/tutor",        mode: "drawer",   cta: "Falar com o Tutor IA" },
  mnemonic:        { route: "/dashboard/mnemonico",    mode: "navigate", cta: "Ativar mnemônico" },
  image_quiz:      { route: "/dashboard/image-quiz",   mode: "navigate", cta: "Treinar imagem clínica" },
  simulado:        { route: "/dashboard/simulados",    mode: "navigate", cta: "Fazer um simulado" },
  clinical_case:   { route: "/dashboard/plantao",      mode: "navigate", cta: "Atender caso clínico" },
  planner_rebuild: { route: "/dashboard",              mode: "inline",   cta: "Gerar missão do dia" },
  reinforcement:   { route: "/dashboard/quiz",         mode: "inline",   cta: "Reforçar tema fraco" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function approvalZone(score: number | null): string {
  if (score == null) return "unknown";
  if (score < 40) return "critical";
  if (score < 60) return "recovery";
  if (score < 80) return "stable";
  return "advanced";
}

function daysBetween(from: string | null | undefined, to: Date): number | null {
  if (!from) return null;
  const d = new Date(from);
  if (isNaN(d.getTime())) return null;
  return Math.floor((to.getTime() - d.getTime()) / 86_400_000);
}

function safeRec(action: OrchestratorAction, opts: Partial<Recommendation> = {}): Recommendation {
  const meta = ACTION_META[action];
  return {
    nextAction: action,
    targetModule: meta.route,
    executionMode: meta.mode,
    priority: opts.priority ?? 10,
    reason: opts.reason ?? "Ação padrão de estudo guiado.",
    cta: opts.cta ?? meta.cta,
    payload: opts.payload ?? {},
    confidence: opts.confidence ?? 0.5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const generatedAt = new Date().toISOString();

  try {
    const userId = await getUserIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const shadowMode: boolean = body?.shadowMode !== false; // default true in F1
    const db = getServiceClient();

    const now = new Date();
    const today = generatedAt.slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    // ── Parallel data fetch (reuses tables already used by study-next) ──
    const [
      revisoes, fsrsDue, errorBank, dailyPlan, dailyTasks,
      visualAttempts, mnemonicFeedback, lastSimulado,
      approval, profile,
    ] = await Promise.all([
      safeQuery<any[]>(db, (c) =>
        c.from("revisoes")
          .select("id, tema_id, data_revisao, prioridade")
          .eq("user_id", userId).eq("status", "pendente")
          .lte("data_revisao", today).limit(50),
        "revisoes"),
      safeQuery<any[]>(db, (c) =>
        c.from("fsrs_cards")
          .select("id, due, lapses, state")
          .eq("user_id", userId).lte("due", generatedAt).limit(50),
        "fsrs_cards"),
      safeQuery<any[]>(db, (c) =>
        c.from("error_bank")
          .select("id, tema, subtema, vezes_errado, categoria_erro, dificuldade, updated_at")
          .eq("user_id", userId).eq("dominado", false)
          .gte("updated_at", sevenDaysAgo)
          .order("vezes_errado", { ascending: false }).limit(20),
        "error_bank"),
      safeQuery<any>(db, (c) =>
        c.from("daily_plans")
          .select("id, completed_count, total_blocks, recovery_mode, content_lock")
          .eq("user_id", userId).eq("plan_date", today).maybeSingle(),
        "daily_plan"),
      safeQuery<any[]>(db, (c) =>
        c.from("daily_plan_tasks")
          .select("id, completed")
          .eq("user_id", userId).eq("completed", false).limit(5),
        "daily_tasks"),
      safeQuery<any[]>(db, (c) =>
        c.from("medical_image_attempts")
          .select("correct, image_type, created_at")
          .eq("user_id", userId)
          .not("image_type", "is", null)
          .gte("created_at", sevenDaysAgo)
          .limit(200),
        "visual_attempts"),
      // Mnemonic utility lives in mnemonic_feedback (not mnemonic_results).
      // Join via result_id → mnemonic_results to fetch tema/sigla.
      safeQuery<any[]>(db, (c) =>
        (c.from("mnemonic_feedback" as any) as any)
          .select("id, result_id, utility_score, mnemonic_results:result_id(id, tema, sigla, request_id, is_latest)")
          .eq("user_id", userId)
          .not("utility_score", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
        "mnemonic_feedback"),
      // Real table name is teacher_simulado_results
      safeQuery<any>(db, (c) =>
        (c.from("teacher_simulado_results" as any) as any)
          .select("created_at, score, total_questions")
          .eq("student_id", userId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        "last_simulado"),
      safeQuery<any>(db, (c) =>
        c.from("approval_scores")
          .select("score, prep_index, chance_score, phase")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        "approval"),
      safeQuery<any>(db, (c) =>
        c.from("profiles")
          .select("exam_date")
          .eq("user_id", userId).maybeSingle(),
        "profile"),
    ]);

    // ── Derive signals ──
    const pendingReviews = revisoes?.length ?? 0;
    const fsrsDueCount = fsrsDue?.length ?? 0;

    // Repeated errors: distinct topics with vezes_errado >= 2 in last 7d
    const repeatedTopicsMap = new Map<string, any>();
    (errorBank ?? []).forEach((e) => {
      if ((e.vezes_errado ?? 0) >= 2 && e.tema) {
        const cur = repeatedTopicsMap.get(e.tema);
        if (!cur || (e.vezes_errado ?? 0) > (cur.vezes_errado ?? 0)) {
          repeatedTopicsMap.set(e.tema, e);
        }
      }
    });
    const repeatedErrorTopics = repeatedTopicsMap.size;
    const topRepeatedError = [...repeatedTopicsMap.values()]
      .sort((a, b) => (b.vezes_errado ?? 0) - (a.vezes_errado ?? 0))[0] ?? null;

    // Top error category
    const categoryCount: Record<string, number> = {};
    (errorBank ?? []).forEach((e) => {
      const cat = (e.categoria_erro ?? "").toLowerCase();
      if (cat) categoryCount[cat] = (categoryCount[cat] ?? 0) + (e.vezes_errado ?? 1);
    });
    const topErrorCategory = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    // Visual weakness: per image_type accuracy < 60% with at least 5 attempts
    const visualByType = new Map<string, { correct: number; total: number }>();
    (visualAttempts ?? []).forEach((a) => {
      const t = a.image_type as string;
      const cur = visualByType.get(t) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (a.correct) cur.correct += 1;
      visualByType.set(t, cur);
    });
    const visualWeaknesses: { type: string; accuracy: number }[] = [];
    visualByType.forEach((v, type) => {
      if (v.total >= 5) {
        const acc = v.correct / v.total;
        if (acc < 0.6) visualWeaknesses.push({ type, accuracy: acc });
      }
    });

    // Mnemonic low utility — utility_score lives in mnemonic_feedback
    const lowUtilFeedback = (mnemonicFeedback ?? [])
      .filter((m: any) => typeof m.utility_score === "number" && m.utility_score < 60);
    const mnemonicLowUtility = lowUtilFeedback.length;
    const lowUtilTop = lowUtilFeedback
      .sort((a: any, b: any) => (a.utility_score ?? 0) - (b.utility_score ?? 0))[0] ?? null;
    const lowUtilTopic: string | null = lowUtilTop?.mnemonic_results?.tema ?? null;
    const lowUtilResultId: string | null = lowUtilTop?.mnemonic_results?.id ?? null;

    // Daily plan empty
    const dailyPlanEmpty = !dailyPlan || (dailyTasks?.length ?? 0) === 0;

    // Last simulado
    const lastSimuladoDaysAgo = daysBetween(lastSimulado?.created_at, now);

    // Approval / exam
    const approvalScore: number | null = approval?.score ?? null;
    const zone = approvalZone(approvalScore);
    const examProximityDays = daysBetween(generatedAt, profile?.exam_date ? new Date(profile.exam_date) : new Date(0));

    // ── Apply rules ──
    const rules: RuleTrace[] = [];
    const candidates: Recommendation[] = [];

    // R1 — FSRS overdue
    {
      const fired = pendingReviews >= 5 || fsrsDueCount >= 5;
      const weight = fired ? 40 : 0;
      rules.push({
        ruleId: "R1", ruleName: "FSRS overdue threshold",
        fired, weight,
        signals: { pendingReviews, fsrsDueCount, threshold: 5 },
      });
      if (fired) {
        candidates.push(safeRec("review_fsrs", {
          priority: 50 + Math.min(40, pendingReviews + fsrsDueCount),
          reason: `Você tem ${pendingReviews + fsrsDueCount} revisões vencidas. Revisar agora protege a curva de retenção.`,
          confidence: 0.9,
        }));
      }
    }

    // R2 — Repeated errors
    {
      const fired = repeatedErrorTopics >= 1;
      const weight = fired ? 30 : 0;
      rules.push({
        ruleId: "R2", ruleName: "Repeated error topics",
        fired, weight,
        signals: { repeatedErrorTopics, topTopic: topRepeatedError?.tema ?? null, vezes: topRepeatedError?.vezes_errado ?? null },
      });
      if (fired && topRepeatedError) {
        candidates.push(safeRec("error_review", {
          priority: 40 + Math.min(30, repeatedErrorTopics * 5 + (topRepeatedError.vezes_errado ?? 0) * 2),
          reason: `Você errou "${topRepeatedError.tema}" ${topRepeatedError.vezes_errado}× recentemente. Hora de quebrar o padrão.`,
          payload: { topic: topRepeatedError.tema, subtopic: topRepeatedError.subtema, errorId: topRepeatedError.id },
          confidence: 0.85,
        }));
      }
    }

    // R3 — Conceptual error → Tutor
    {
      const isConceptual = topErrorCategory === "conceitual" || topErrorCategory === "compreensao" || topErrorCategory === "compreensão";
      const fired = isConceptual && repeatedErrorTopics >= 1;
      const weight = fired ? 25 : 0;
      rules.push({
        ruleId: "R3", ruleName: "Conceptual error triggers tutor",
        fired, weight,
        signals: { topErrorCategory, repeatedErrorTopics },
      });
      if (fired && topRepeatedError) {
        candidates.push(safeRec("tutor", {
          priority: 35 + (repeatedErrorTopics * 3),
          reason: `Erros conceituais em "${topRepeatedError.tema}". O Tutor pode destravar a base.`,
          payload: { topic: topRepeatedError.tema, tutorPhase: "correction" },
          confidence: 0.75,
        }));
      }
    }

    // R4 — Memorization error or low-utility mnemonic → Mnemônico
    {
      const isMem = topErrorCategory === "memorizacao" || topErrorCategory === "memorização";
      const fired = isMem || mnemonicLowUtility >= 1;
      const weight = fired ? 25 : 0;
      rules.push({
        ruleId: "R4", ruleName: "Memorization gap triggers mnemonic",
        fired, weight,
        signals: { topErrorCategory, mnemonicLowUtility, isMem },
      });
      if (fired) {
        const targetTopic = lowUtilTopic ?? topRepeatedError?.tema ?? null;
        const targetSubtopic = topRepeatedError?.subtema ?? null;
        const mode: "review_existing" | "regenerate" | "create_new" =
          lowUtilTop ? "regenerate" : topRepeatedError ? "create_new" : "review_existing";
        candidates.push(safeRec("mnemonic", {
          priority: 35 + mnemonicLowUtility * 4,
          reason: lowUtilTop
            ? `Mnemônico com baixa utilidade (${lowUtilTop.utility_score}/100). Vamos refazer.`
            : `Padrão de esquecimento em "${targetTopic ?? "tema fraco"}". Mnemônico pode fixar.`,
          payload: {
            topic: targetTopic ?? undefined,
            subtopic: targetSubtopic ?? undefined,
            mnemonicMode: mode,
            resultId: lowUtilResultId ?? undefined,
          },
          confidence: 0.7,
        }));
      }
    }

    // R5 — Visual weakness → Image Quiz
    {
      const fired = visualWeaknesses.length > 0;
      const weight = fired ? 20 : 0;
      const worst = visualWeaknesses.sort((a, b) => a.accuracy - b.accuracy)[0];
      rules.push({
        ruleId: "R5", ruleName: "Visual accuracy weakness",
        fired, weight,
        signals: {
          weakImageTypes: visualWeaknesses.length,
          worstType: worst?.type ?? null,
          worstAccuracy: worst ? Math.round(worst.accuracy * 100) : null,
        },
      });
      if (fired && worst) {
        candidates.push(safeRec("image_quiz", {
          priority: 30 + Math.round((1 - worst.accuracy) * 30),
          reason: `Acurácia visual de ${Math.round(worst.accuracy * 100)}% em ${worst.type}. Bora treinar.`,
          payload: { imageType: worst.type },
          confidence: 0.8,
        }));
      }
    }

    // R6 — Stable performance + no overdue → Simulado
    {
      const stable = (approvalScore ?? 0) >= 70 && pendingReviews === 0 && fsrsDueCount === 0;
      const cooldownOk = lastSimuladoDaysAgo == null || lastSimuladoDaysAgo >= 7;
      const fired = stable && cooldownOk;
      const weight = fired ? 15 : 0;
      rules.push({
        ruleId: "R6", ruleName: "Stable base unlocks simulado",
        fired, weight,
        signals: { approvalScore, pendingReviews, fsrsDueCount, lastSimuladoDaysAgo, zone },
      });
      if (fired) {
        candidates.push(safeRec("simulado", {
          priority: 25,
          reason: `Base sólida (score ${approvalScore}) e revisões em dia. Hora de medir desempenho real.`,
          confidence: 0.7,
        }));
      }
    }

    // R7 — Default study session (always present, low base)
    {
      rules.push({
        ruleId: "R7", ruleName: "Default guided study session",
        fired: true, weight: 10,
        signals: { weakestTopic: topRepeatedError?.tema ?? null },
      });
      candidates.push(safeRec("study_session", {
        priority: 10 + (topRepeatedError ? 5 : 0),
        reason: topRepeatedError
          ? `Sessão guiada focada em "${topRepeatedError.tema}".`
          : "Sessão guiada para manter o ritmo.",
        payload: topRepeatedError ? { topic: topRepeatedError.tema } : {},
        confidence: 0.6,
      }));
    }

    // R8 — Empty daily plan
    {
      const fired = dailyPlanEmpty;
      const weight = fired ? 50 : 0;
      rules.push({
        ruleId: "R8", ruleName: "Daily plan missing",
        fired, weight,
        signals: { dailyPlanEmpty, pendingTasks: dailyTasks?.length ?? 0 },
      });
      if (fired) {
        candidates.push(safeRec("planner_rebuild", {
          priority: 60,
          reason: "Sua missão do dia ainda não foi gerada. Vamos montar agora.",
          confidence: 0.95,
        }));
      }
    }

    // ── Pick winner + diverse alternatives ──
    candidates.sort((a, b) => b.priority - a.priority);
    const winner = candidates[0];
    const alternatives: Recommendation[] = [];
    const seen = new Set<OrchestratorAction>([winner.nextAction]);
    for (const c of candidates) {
      if (alternatives.length >= 3) break;
      if (!seen.has(c.nextAction)) {
        alternatives.push(c);
        seen.add(c.nextAction);
      }
    }

    const adaptiveState = {
      pendingReviews,
      fsrsDueCount,
      repeatedErrorTopics,
      topErrorCategory,
      visualWeaknessCount: visualWeaknesses.length,
      mnemonicLowUtility,
      dailyPlanEmpty,
      lastSimuladoDaysAgo,
      approvalScore,
      approvalZone: zone,
      examProximityDays,
      weakestTopic: topRepeatedError?.tema ?? null,
      recommendedModality: winner.nextAction,
    };

    // ── Log decision (final + full rule trace) ──
    await logDecision(db, {
      user_id: userId,
      decision_type: "orchestration",
      source_module: "study-orchestrator",
      input_snapshot: {
        adaptiveState,
        signals: {
          pendingReviews, fsrsDueCount, repeatedErrorTopics, topErrorCategory,
          visualWeaknesses, mnemonicLowUtility, dailyPlanEmpty,
          lastSimuladoDaysAgo, approvalScore, zone,
        },
      },
      decision_output: {
        nextAction: winner.nextAction,
        priority: winner.priority,
        targetModule: winner.targetModule,
        executionMode: winner.executionMode,
        payload: winner.payload,
        cta: winner.cta,
        alternatives: alternatives.map((a) => ({
          nextAction: a.nextAction, priority: a.priority, reason: a.reason,
        })),
        rulesTrace: rules,
        shadowMode,
      },
      justification: winner.reason,
      confidence_score: winner.confidence,
    });

    return jsonResponse({
      success: true,
      recommendation: winner,
      alternatives,
      adaptiveState,
      rulesTrace: rules,
      shadowMode,
      generatedAt,
    });
  } catch (e) {
    console.error("[study-orchestrator]", e);
    // Safe fallback — never break the caller
    const fallback = safeRec("study_session", {
      reason: "Orquestrador indisponível — usando sessão guiada padrão.",
      priority: 5,
      confidence: 0.3,
    });
    return jsonResponse({
      success: false,
      error: e instanceof Error ? e.message : "Erro interno",
      recommendation: fallback,
      alternatives: [],
      adaptiveState: null,
      rulesTrace: [],
      shadowMode: true,
      generatedAt,
    });
  }
});
