/**
 * study-orchestrator V2 — cérebro adaptativo
 *
 * Sobre F1–F6 (mantém compatibilidade total):
 *   • Memória de ações (últimas 5 + por modalidade + por tema)
 *   • Cooldown por regra (R3 45m, R4 60m, R5 30m, R6 24h)
 *   • Perfil cognitivo / efetividade por modalidade
 *   • Exploração controlada (epsilon-greedy ~12%)
 *   • Fase de estudo (base / consolidacao / reta_final)
 *   • Fadiga cognitiva
 *   • Regras novas: R9 anti-repetição, R10 efetividade, R11 fadiga, R12 exploração, R13 phase
 *   • rulesTrace ricamente decomposto (base, tuned, penalties, boosts, finalScore)
 *
 * NUNCA propaga erro — sempre retorna fallback study_session.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders, jsonResponse, errorResponse,
  getServiceClient, getUserIdFromRequest, safeQuery, logDecision,
} from "../_shared/assistant-helpers.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types (espelhados em src/types/orchestrator.ts)
// ─────────────────────────────────────────────────────────────────────────────
type OrchestratorAction =
  | "study_session" | "review_fsrs" | "error_review" | "tutor" | "mnemonic"
  | "image_quiz" | "simulado" | "clinical_case" | "planner_rebuild" | "reinforcement";

type StudyPhase = "base" | "consolidacao" | "reta_final" | "unknown";
type FatigueLevel = "low" | "medium" | "high";
type RecommendationBadge =
  | "exploring" | "repetition_avoided" | "tutor_favored"
  | "high_review_urgency" | "fatigue_aware" | "phase_aligned";

interface RuleTrace {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  weight: number;            // legacy: == finalScore
  baseWeight?: number;
  tunedWeight?: number;
  cooldownPenalty?: number;
  repetitionPenalty?: number;
  effectivenessBoost?: number;
  phaseBoost?: number;
  fatiguePenalty?: number;
  explorationAdjustment?: number;
  finalScore?: number;
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
  badges?: RecommendationBadge[];
  humanReason?: string;
  /** internal — qual regra produziu este candidato */
  _ruleId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing table
// ─────────────────────────────────────────────────────────────────────────────
// P0-bis: routes MUST exist in src/App.tsx — missing routes silently drop ?did=
// and break the orchestrator → outcome loop. All routes here are verified.
const ACTION_META: Record<OrchestratorAction, { route: string; mode: "inline" | "navigate" | "drawer"; cta: string }> = {
  study_session:   { route: "/dashboard/sessao-estudo",                  mode: "navigate", cta: "Começar sessão guiada" },
  review_fsrs:     { route: "/dashboard/sessao-estudo?focus=reviews",    mode: "navigate", cta: "Fazer revisões pendentes" },
  error_review:    { route: "/dashboard/banco-erros",                    mode: "navigate", cta: "Revisar erros recorrentes" },
  tutor:           { route: "/dashboard/tutor",                          mode: "drawer",   cta: "Falar com o Tutor IA" },
  mnemonic:        { route: "/dashboard/mnemonico",                      mode: "navigate", cta: "Ativar mnemônico" },
  image_quiz:      { route: "/dashboard/image-quiz",                     mode: "navigate", cta: "Treinar imagem clínica" },
  simulado:        { route: "/dashboard/simulados",                      mode: "navigate", cta: "Fazer um simulado" },
  clinical_case:   { route: "/dashboard/plantao",                        mode: "navigate", cta: "Atender caso clínico" },
  planner_rebuild: { route: "/dashboard",                                mode: "inline",   cta: "Gerar missão do dia" },
  reinforcement:   { route: "/dashboard/sessao-estudo",                  mode: "navigate", cta: "Reforçar tema fraco" },
};

const HEAVY_ACTIONS = new Set<OrchestratorAction>(["simulado", "clinical_case", "image_quiz"]);
const LIGHT_ACTIONS = new Set<OrchestratorAction>(["review_fsrs", "tutor", "reinforcement", "mnemonic"]);

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

function minutesSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 60_000);
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
    badges: opts.badges,
    humanReason: opts.humanReason,
    _ruleId: opts._ruleId,
  };
}

function inferStudyPhase(approvalScore: number | null, examDays: number | null): StudyPhase {
  if (examDays != null) {
    if (examDays <= 30) return "reta_final";
    if (examDays <= 90) return "consolidacao";
    return "base";
  }
  if (approvalScore == null) return "unknown";
  if (approvalScore < 50) return "base";
  if (approvalScore < 75) return "consolidacao";
  return "reta_final";
}

// Phase × action multiplier
const PHASE_BOOST: Record<StudyPhase, Partial<Record<OrchestratorAction, number>>> = {
  base: {
    tutor: 1.20, study_session: 1.15, mnemonic: 1.15,
    simulado: 0.80, clinical_case: 0.85,
  },
  consolidacao: {
    review_fsrs: 1.20, error_review: 1.20, image_quiz: 1.15,
    tutor: 1.05, simulado: 1.00,
  },
  reta_final: {
    simulado: 1.30, review_fsrs: 1.25, reinforcement: 1.20,
    error_review: 1.15, mnemonic: 0.85, study_session: 0.90,
  },
  unknown: {},
};

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
    const shadowMode: boolean = body?.shadowMode === true;
    const db = getServiceClient();

    const now = new Date();
    const today = generatedAt.slice(0, 10);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const startOfDay = new Date(today + "T00:00:00.000Z").toISOString();

    // ── Reset fence (jornada atual): qualquer dado anterior ao último reset
    // é IGNORADO pelo orquestrador. Histórico permanece nas tabelas e nas
    // páginas próprias (Histórico/Cronograma/FSRS), apenas não é mais
    // considerado pelas regras de "ação atual" do plano.
    const { data: resetProfile } = await db
      .from("profiles")
      .select("last_study_plan_reset_at")
      .eq("user_id", userId)
      .maybeSingle();
    const resetAt: string = (resetProfile as any)?.last_study_plan_reset_at
      || "1900-01-01T00:00:00Z";
    // Janela efetiva: mais recente entre "7 dias atrás" e o reset.
    const recentSince = resetAt > sevenDaysAgo ? resetAt : sevenDaysAgo;

    // ── Parallel data fetch ──
    const [
      revisoes, fsrsDue, errorBank, dailyPlan, dailyTasks,
      visualAttempts, mnemonicFeedback, lastSimulado,
      approval, profile,
      // V2 — memória + outcomes
      recentDecisions, recentOutcomes, completedTasksToday,
    ] = await Promise.all([
      safeQuery<any[]>(db, (c) =>
        c.from("revisoes")
          .select("id, tema_id, data_revisao, prioridade")
          .eq("user_id", userId).eq("status", "pendente")
          .gt("created_at", resetAt)
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
          .gte("updated_at", recentSince)
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
          .eq("user_id", userId).not("image_type", "is", null)
          .gte("created_at", sevenDaysAgo).limit(200),
        "visual_attempts"),
      safeQuery<any[]>(db, (c) =>
        (c.from("mnemonic_feedback" as any) as any)
          .select("id, result_id, utility_score, mnemonic_results:result_id(id, tema, sigla, request_id, is_latest)")
          .eq("user_id", userId).not("utility_score", "is", null)
          .order("created_at", { ascending: false }).limit(50),
        "mnemonic_feedback"),
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
      // V2: últimas 8 decisões do orquestrador
      safeQuery<any[]>(db, (c) =>
        c.from("assistant_decisions")
          .select("id, decision_output, justification, created_at")
          .eq("user_id", userId)
          .eq("source_module", "study-orchestrator")
          .order("created_at", { ascending: false }).limit(8),
        "recent_decisions"),
      // V2: outcomes recentes para perfil de efetividade
      safeQuery<any[]>(db, (c) =>
        c.from("orchestrator_outcomes")
          .select("next_action, modality, improvement_delta, retention_delta, error_reduction, followed, topic, created_at")
          .eq("user_id", userId)
          .gte("created_at", new Date(now.getTime() - 30 * 86_400_000).toISOString())
          .limit(200),
        "recent_outcomes"),
      // V2: tarefas completadas hoje (proxy de fadiga)
      safeQuery<any[]>(db, (c) =>
        c.from("daily_plan_tasks")
          .select("id, completed_at, task_type")
          .eq("user_id", userId).eq("completed", true)
          .gte("completed_at", startOfDay).limit(50),
        "completed_today"),
    ]);

    // F6 — Tuned weights
    const { data: weightRows } = await db
      .from("orchestrator_rule_weights")
      .select("rule_id, current_weight, cooldown_minutes");
    const ruleWeight = (id: string): number => {
      const row = (weightRows ?? []).find((w: any) => w.rule_id === id);
      const w = row ? Number(row.current_weight) : 1.0;
      return Number.isFinite(w) && w > 0 ? w : 1.0;
    };
    const ruleCooldown = (id: string): number => {
      const row = (weightRows ?? []).find((w: any) => w.rule_id === id);
      return row?.cooldown_minutes ?? 0;
    };

    // ── Derive base signals ──
    const pendingReviews = revisoes?.length ?? 0;
    const fsrsDueCount = fsrsDue?.length ?? 0;

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

    const categoryCount: Record<string, number> = {};
    (errorBank ?? []).forEach((e) => {
      const cat = (e.categoria_erro ?? "").toLowerCase();
      if (cat) categoryCount[cat] = (categoryCount[cat] ?? 0) + (e.vezes_errado ?? 1);
    });
    const topErrorCategory = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

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

    const lowUtilFeedback = (mnemonicFeedback ?? [])
      .filter((m: any) => typeof m.utility_score === "number" && m.utility_score < 60);
    const mnemonicLowUtility = lowUtilFeedback.length;
    const lowUtilTop = lowUtilFeedback
      .sort((a: any, b: any) => (a.utility_score ?? 0) - (b.utility_score ?? 0))[0] ?? null;
    const lowUtilTopic: string | null = lowUtilTop?.mnemonic_results?.tema ?? null;
    const lowUtilResultId: string | null = lowUtilTop?.mnemonic_results?.id ?? null;

    const dailyPlanEmpty = !dailyPlan || (dailyTasks?.length ?? 0) === 0;
    const lastSimuladoDaysAgo = daysBetween(lastSimulado?.created_at, now);
    const approvalScore: number | null = approval?.score ?? null;
    const zone = approvalZone(approvalScore);
    const examProximityDays = profile?.exam_date
      ? Math.max(0, Math.floor((new Date(profile.exam_date).getTime() - now.getTime()) / 86_400_000))
      : null;

    // ── V2: Memória de ações ──
    const memRecent: { action: OrchestratorAction; topic: string | null; at: string }[] = [];
    const memLastByModality: Partial<Record<OrchestratorAction, string>> = {};
    const memLastByTopic: Record<string, { action: OrchestratorAction; at: string }> = {};
    for (const d of (recentDecisions ?? []).slice(0, 5)) {
      const out: any = d.decision_output ?? {};
      const action = out.nextAction as OrchestratorAction | undefined;
      const topic = (out.payload?.topic as string) ?? null;
      if (!action) continue;
      memRecent.push({ action, topic, at: d.created_at });
    }
    for (const d of (recentDecisions ?? [])) {
      const out: any = d.decision_output ?? {};
      const action = out.nextAction as OrchestratorAction | undefined;
      const topic = (out.payload?.topic as string) ?? null;
      if (!action) continue;
      if (!memLastByModality[action]) memLastByModality[action] = d.created_at;
      if (topic && !memLastByTopic[topic]) memLastByTopic[topic] = { action, at: d.created_at };
    }
    const repeatedCount = memRecent.length > 0
      ? memRecent.filter((m) => m.action === memRecent[0].action).length
      : 0;

    // ── V2: Perfil cognitivo / efetividade ──
    const effByModality: Partial<Record<OrchestratorAction, { sum: number; n: number }>> = {};
    for (const o of (recentOutcomes ?? [])) {
      const m = (o.modality ?? o.next_action) as OrchestratorAction | undefined;
      if (!m) continue;
      const delta = Number(o.improvement_delta ?? 0);
      if (!Number.isFinite(delta)) continue;
      const cur = effByModality[m] ?? { sum: 0, n: 0 };
      cur.sum += delta;
      cur.n += 1;
      effByModality[m] = cur;
    }
    const effAverages: Partial<Record<OrchestratorAction, number>> = {};
    let bestModality: OrchestratorAction | null = null;
    let worstModality: OrchestratorAction | null = null;
    let bestVal = -Infinity, worstVal = Infinity, totalSamples = 0;
    for (const [k, v] of Object.entries(effByModality)) {
      if (!v || v.n === 0) continue;
      const avg = v.sum / v.n;
      effAverages[k as OrchestratorAction] = Math.round(avg * 1000) / 1000;
      totalSamples += v.n;
      if (avg > bestVal) { bestVal = avg; bestModality = k as OrchestratorAction; }
      if (avg < worstVal) { worstVal = avg; worstModality = k as OrchestratorAction; }
    }
    const effectivenessBoostFor = (a: OrchestratorAction): number => {
      const v = effAverages[a];
      if (v == null) return 1.0;
      // ±20% baseado em delta histórico (clamp)
      return Math.max(0.8, Math.min(1.2, 1 + v * 0.4));
    };

    // ── V2: Fase de estudo ──
    const studyPhase: StudyPhase = inferStudyPhase(approvalScore, examProximityDays);

    // ── V2: Fadiga ──
    const completedToday = completedTasksToday?.length ?? 0;
    const heavyToday = (completedTasksToday ?? []).filter((t: any) =>
      ["simulado", "clinical_case", "image_quiz"].includes(t.task_type)).length;
    let fatigueScore = 0;
    fatigueScore += completedToday * 8;
    fatigueScore += heavyToday * 12;
    fatigueScore = Math.min(100, fatigueScore);
    const fatigue: FatigueLevel = fatigueScore >= 70 ? "high" : fatigueScore >= 40 ? "medium" : "low";

    // ── Cooldown helper (V2 — penaliza ações recentes da MESMA modalidade) ──
    const cooldownPenaltyFor = (ruleId: string, action: OrchestratorAction): number => {
      const cdMin = ruleCooldown(ruleId);
      if (!cdMin) return 1.0;
      const lastIso = memLastByModality[action];
      const mins = minutesSince(lastIso, now);
      if (mins == null) return 1.0;
      if (mins < cdMin) {
        // dentro do cooldown — corte agressivo (60–90%)
        const ratio = mins / cdMin; // 0 = disparo recente
        return 0.1 + 0.6 * ratio; // entre 0.1 e 0.7
      }
      return 1.0;
    };

    // ── Repetition penalty (R9) ──
    const repetitionPenaltyFor = (action: OrchestratorAction): number => {
      const sameInRecent = memRecent.filter((m) => m.action === action).length;
      if (sameInRecent <= 1) return 1.0;
      if (sameInRecent === 2) return 0.85;
      if (sameInRecent === 3) return 0.6;
      return 0.4; // 4+ vezes seguidas
    };

    // ── Phase boost (R13) ──
    const phaseBoostFor = (action: OrchestratorAction): number => {
      return PHASE_BOOST[studyPhase][action] ?? 1.0;
    };

    // ── Fatigue penalty (R11) ──
    const fatiguePenaltyFor = (action: OrchestratorAction): number => {
      if (fatigue === "low") return 1.0;
      const heavy = HEAVY_ACTIONS.has(action);
      const light = LIGHT_ACTIONS.has(action);
      if (fatigue === "medium") return heavy ? 0.85 : (light ? 1.05 : 1.0);
      // high
      return heavy ? 0.55 : (light ? 1.15 : 0.95);
    };

    // ── Apply rules ──
    const rules: RuleTrace[] = [];
    const candidates: Recommendation[] = [];

    // helper: aplica todos os modificadores e empurra candidato + trace
    const pushCandidate = (
      ruleId: string,
      ruleName: string,
      action: OrchestratorAction,
      baseWeight: number,
      partial: Partial<Recommendation>,
      signals: Record<string, any>,
      fired = true,
    ) => {
      const tunedW = ruleWeight(ruleId);
      const tuned = baseWeight * tunedW;
      const cdPen = cooldownPenaltyFor(ruleId, action);
      const repPen = repetitionPenaltyFor(action);
      const effBoost = effectivenessBoostFor(action);
      const phBoost = phaseBoostFor(action);
      const fatPen = fatiguePenaltyFor(action);

      const finalScore = Math.round(tuned * cdPen * repPen * effBoost * phBoost * fatPen);

      rules.push({
        ruleId, ruleName, fired,
        weight: finalScore,
        baseWeight,
        tunedWeight: Math.round(tuned),
        cooldownPenalty: Number(cdPen.toFixed(2)),
        repetitionPenalty: Number(repPen.toFixed(2)),
        effectivenessBoost: Number(effBoost.toFixed(2)),
        phaseBoost: Number(phBoost.toFixed(2)),
        fatiguePenalty: Number(fatPen.toFixed(2)),
        finalScore,
        signals,
      });

      if (!fired) return;

      const badges: RecommendationBadge[] = [];
      if (cdPen < 0.7 || repPen < 0.7) badges.push("repetition_avoided");
      if (effBoost > 1.05) badges.push("tutor_favored"); // genérico "preferred"
      if (phBoost > 1.05) badges.push("phase_aligned");
      if (fatPen < 0.9) badges.push("fatigue_aware");
      if (action === "review_fsrs" && (pendingReviews + fsrsDueCount) >= 10) badges.push("high_review_urgency");

      candidates.push(safeRec(action, {
        ...partial,
        priority: finalScore,
        badges: badges.length ? badges : undefined,
        _ruleId: ruleId,
      }));
    };

    // R1 — FSRS overdue
    {
      const fired = pendingReviews >= 5 || fsrsDueCount >= 5;
      const base = fired ? 50 + Math.min(40, pendingReviews + fsrsDueCount) : 0;
      pushCandidate("R1", "FSRS overdue threshold", "review_fsrs", base, {
        reason: `Você tem ${pendingReviews + fsrsDueCount} revisões vencidas. Revisar agora protege a curva de retenção.`,
        humanReason: "Revisões acumuladas comprometem retenção exponencialmente.",
        confidence: 0.9,
      }, { pendingReviews, fsrsDueCount, threshold: 5 }, fired);
    }

    // R2 — Repeated errors
    {
      const fired = repeatedErrorTopics >= 1;
      const base = fired ? 40 + Math.min(30, repeatedErrorTopics * 5 + (topRepeatedError?.vezes_errado ?? 0) * 2) : 0;
      pushCandidate("R2", "Repeated error topics", "error_review", base, {
        reason: topRepeatedError ? `Você errou "${topRepeatedError.tema}" ${topRepeatedError.vezes_errado}× recentemente.` : "Erros recorrentes detectados.",
        humanReason: "Quebrar padrões de erro recorrente é a forma mais eficiente de subir score.",
        payload: topRepeatedError ? { topic: topRepeatedError.tema, subtopic: topRepeatedError.subtema, errorId: topRepeatedError.id } : {},
        confidence: 0.85,
      }, { repeatedErrorTopics, topTopic: topRepeatedError?.tema ?? null, vezes: topRepeatedError?.vezes_errado ?? null }, fired);
    }

    // R3 — Conceptual error → Tutor
    {
      const isConceptual = topErrorCategory === "conceitual" || topErrorCategory === "compreensao" || topErrorCategory === "compreensão";
      const fired = isConceptual && repeatedErrorTopics >= 1;
      const base = fired ? 35 + (repeatedErrorTopics * 3) : 0;
      pushCandidate("R3", "Conceptual error triggers tutor", "tutor", base, {
        reason: topRepeatedError ? `Erros conceituais em "${topRepeatedError.tema}". O Tutor pode destravar a base.` : "Erros conceituais detectados.",
        humanReason: "Quando o erro é de compreensão, explicação dialogada supera repetição.",
        payload: topRepeatedError ? { topic: topRepeatedError.tema, tutorPhase: "correction" } : {},
        confidence: 0.75,
      }, { topErrorCategory, repeatedErrorTopics }, fired);
    }

    // R4 — Memorization gap → Mnemônico
    {
      const isMem = topErrorCategory === "memorizacao" || topErrorCategory === "memorização";
      const fired = isMem || mnemonicLowUtility >= 1;
      const base = fired ? 35 + mnemonicLowUtility * 4 : 0;
      const targetTopic = lowUtilTopic ?? topRepeatedError?.tema ?? null;
      const mode: "review_existing" | "regenerate" | "create_new" =
        lowUtilTop ? "regenerate" : topRepeatedError ? "create_new" : "review_existing";
      pushCandidate("R4", "Memorization gap triggers mnemonic", "mnemonic", base, {
        reason: lowUtilTop
          ? `Mnemônico com baixa utilidade (${lowUtilTop.utility_score}/100). Vamos refazer.`
          : `Padrão de esquecimento em "${targetTopic ?? "tema fraco"}". Mnemônico pode fixar.`,
        humanReason: "Falhas de memorização respondem melhor a associação visual/fonética.",
        payload: { topic: targetTopic ?? undefined, subtopic: topRepeatedError?.subtema ?? undefined, mnemonicMode: mode, resultId: lowUtilResultId ?? undefined },
        confidence: 0.7,
      }, { topErrorCategory, mnemonicLowUtility, isMem }, fired);
    }

    // R5 — Visual weakness → Image Quiz
    {
      const fired = visualWeaknesses.length > 0;
      const worst = visualWeaknesses.sort((a, b) => a.accuracy - b.accuracy)[0];
      const base = fired && worst ? 30 + Math.round((1 - worst.accuracy) * 30) : 0;
      pushCandidate("R5", "Visual accuracy weakness", "image_quiz", base, {
        reason: worst ? `Acurácia visual de ${Math.round(worst.accuracy * 100)}% em ${worst.type}. Bora treinar.` : "Fraqueza visual detectada.",
        humanReason: "Reconhecimento de padrões clínicos exige treino dedicado.",
        payload: worst ? { imageType: worst.type } : {},
        confidence: 0.8,
      }, {
        weakImageTypes: visualWeaknesses.length,
        worstType: worst?.type ?? null,
        worstAccuracy: worst ? Math.round(worst.accuracy * 100) : null,
      }, fired);
    }

    // R6 — Stable performance → Simulado
    {
      const stable = (approvalScore ?? 0) >= 70 && pendingReviews === 0 && fsrsDueCount === 0;
      const cooldownOk = lastSimuladoDaysAgo == null || lastSimuladoDaysAgo >= 7;
      const fired = stable && cooldownOk;
      const base = fired ? 25 : 0;
      pushCandidate("R6", "Stable base unlocks simulado", "simulado", base, {
        reason: `Base sólida (score ${approvalScore}) e revisões em dia. Hora de medir desempenho real.`,
        humanReason: "Quando a base está estável, simulado calibra resistência sob pressão.",
        confidence: 0.7,
      }, { approvalScore, pendingReviews, fsrsDueCount, lastSimuladoDaysAgo, zone }, fired);
    }

    // R7 — Default study session
    {
      const base = 10 + (topRepeatedError ? 5 : 0);
      pushCandidate("R7", "Default guided study session", "study_session", base, {
        reason: topRepeatedError ? `Sessão guiada focada em "${topRepeatedError.tema}".` : "Sessão guiada para manter o ritmo.",
        humanReason: "Manter o ritmo diário de estudo é a base do desempenho.",
        payload: topRepeatedError ? { topic: topRepeatedError.tema } : {},
        confidence: 0.6,
      }, { weakestTopic: topRepeatedError?.tema ?? null }, true);
    }

    // R8 — Empty daily plan + auto-fallback
    {
      const fired = dailyPlanEmpty;
      const base = fired ? 60 : 0;
      pushCandidate("R8", "Daily plan missing", "planner_rebuild", base, {
        reason: "Sua missão do dia ainda não foi gerada. Vamos montar agora.",
        humanReason: "Sem plano, o aluno tende a estudar reativamente — perde foco.",
        confidence: 0.95,
      }, { dailyPlanEmpty, pendingTasks: dailyTasks?.length ?? 0 }, fired);

      if (fired) {
        try {
          const { data: planRow } = await db.from("daily_plans").upsert({
            user_id: userId, plan_date: today,
            objective: topRepeatedError?.tema ? `Reforçar ${topRepeatedError.tema}` : "Sessão guiada do dia",
            phase: studyPhase, plan_json: { source: "orchestrator_v2_fallback", studyPhase },
            total_blocks: 3, completed_count: 0,
          }, { onConflict: "user_id,plan_date" }).select("id").maybeSingle();

          if (planRow?.id) {
            const { data: existingTasks } = await db.from("daily_plan_tasks")
              .select("id").eq("daily_plan_id", planRow.id).limit(1);
            if (!existingTasks || existingTasks.length === 0) {
              const fallbackTasks = [
                topRepeatedError ? {
                  daily_plan_id: planRow.id, user_id: userId,
                  task_type: "error_review", title: `Revisar erro: ${topRepeatedError.tema}`,
                  topic: topRepeatedError.tema, ordem: 1, estimated_minutes: 15, priority: "high",
                } : null,
                visualWeaknesses[0] ? {
                  daily_plan_id: planRow.id, user_id: userId,
                  task_type: "image_quiz", title: `Treinar imagem: ${visualWeaknesses[0].type}`,
                  topic: visualWeaknesses[0].type, ordem: 2, estimated_minutes: 10, priority: "medium",
                } : null,
                {
                  daily_plan_id: planRow.id, user_id: userId,
                  task_type: "free_study", title: "Sessão guiada de estudo",
                  topic: topRepeatedError?.tema ?? null, ordem: 3, estimated_minutes: 20, priority: "medium",
                },
              ].filter(Boolean) as any[];
              if (fallbackTasks.length > 0) await db.from("daily_plan_tasks").insert(fallbackTasks);
            }
          }
        } catch (e) {
          console.warn("[orchestrator-v2] planner fallback failed:", (e as Error).message);
        }
      }
    }

    // ── Modulator traces (R9-R13) — não geram candidates próprios; documentam ajustes
    rules.push({
      ruleId: "R9", ruleName: "Repetição excessiva (anti-loop)",
      fired: repeatedCount >= 2, weight: 0,
      signals: { lastAction: memRecent[0]?.action ?? null, repeatedCount, recent: memRecent.length },
      notes: "Aplica repetitionPenalty multiplicativo nos candidates.",
    });
    rules.push({
      ruleId: "R10", ruleName: "Boost por efetividade individual",
      fired: bestModality != null, weight: 0,
      signals: { bestModality, worstModality, sampleSize: totalSamples },
      notes: "Aplica effectivenessBoost (0.8–1.2) baseado em improvement_delta histórico.",
    });
    rules.push({
      ruleId: "R11", ruleName: "Fadiga cognitiva",
      fired: fatigue !== "low", weight: 0,
      signals: { fatigue, fatigueScore, completedToday, heavyToday },
      notes: "Reduz peso de ações pesadas conforme fadiga.",
    });

    // R12 — Exploração controlada (epsilon-greedy)
    let exploration = false;
    {
      candidates.sort((a, b) => b.priority - a.priority);
      const top = candidates[0];
      const second = candidates[1];
      const close = top && second && (top.priority - second.priority) <= Math.max(5, top.priority * 0.1);
      const repeating = repeatedCount >= 3;
      const epsilon = repeating ? 0.20 : (close ? 0.15 : 0.07);
      if (Math.random() < epsilon && second && second.nextAction !== top?.nextAction) {
        // promove o segundo a vencedor com tag de exploração
        exploration = true;
        const bumped = { ...second, priority: top.priority + 1, badges: [...(second.badges ?? []), "exploring" as RecommendationBadge] };
        candidates.splice(candidates.indexOf(second), 1);
        candidates.unshift(bumped);
      }
      rules.push({
        ruleId: "R12", ruleName: "Exploração controlada",
        fired: exploration, weight: 0,
        signals: {
          epsilon: Number(epsilon.toFixed(2)),
          topAction: top?.nextAction ?? null,
          secondAction: second?.nextAction ?? null,
          gap: top && second ? top.priority - second.priority : null,
          triggered: exploration,
        },
        notes: exploration ? "Exploração ativada — promovendo alternativa." : "Exploração não ativada nesta decisão.",
      });
    }

    rules.push({
      ruleId: "R13", ruleName: "Phase boost",
      fired: studyPhase !== "unknown", weight: 0,
      signals: { studyPhase, examProximityDays, approvalScore },
      notes: "Aplica phaseBoost por modalidade (ver PHASE_BOOST table).",
    });

    // ── Pick winner + alternativas diversas ──
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
      pendingReviews, fsrsDueCount, repeatedErrorTopics, topErrorCategory,
      visualWeaknessCount: visualWeaknesses.length, mnemonicLowUtility,
      dailyPlanEmpty, lastSimuladoDaysAgo, approvalScore, approvalZone: zone,
      examProximityDays, weakestTopic: topRepeatedError?.tema ?? null,
      recommendedModality: winner.nextAction,
      // V2
      studyPhase, fatigue, fatigueScore,
      actionsCompletedToday: completedToday,
      memory: {
        recent: memRecent,
        lastByModality: memLastByModality,
        lastByTopic: memLastByTopic,
        repeatedCount,
      },
      effectiveness: {
        byModality: effAverages,
        bestModality, worstModality,
        sampleSize: totalSamples,
      },
      exploration,
    };

    // ── Log decisão ──
    const { id: decisionId } = await logDecision(db, {
      user_id: userId,
      decision_type: "orchestration",
      source_module: "study-orchestrator",
      input_snapshot: { adaptiveState, rulesCount: rules.length },
      decision_output: {
        nextAction: winner.nextAction,
        priority: winner.priority,
        targetModule: winner.targetModule,
        executionMode: winner.executionMode,
        payload: winner.payload,
        cta: winner.cta,
        badges: winner.badges,
        ruleId: winner._ruleId,
        alternatives: alternatives.map((a) => ({
          nextAction: a.nextAction, priority: a.priority, reason: a.reason, ruleId: a._ruleId,
        })),
        rulesTrace: rules,
        shadowMode,
        version: "v2",
      },
      justification: winner.reason,
      confidence_score: winner.confidence,
    }) as any ?? {};

    // limpa campos internos antes de devolver
    const cleanup = (r: Recommendation): Recommendation => {
      const { _ruleId, ...rest } = r;
      return rest;
    };

    return jsonResponse({
      success: true,
      recommendation: cleanup(winner),
      alternatives: alternatives.map(cleanup),
      adaptiveState,
      rulesTrace: rules,
      decisionId,
      shadowMode,
      generatedAt,
    });
  } catch (e) {
    console.error("[study-orchestrator-v2]", e);
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg.includes("Autenticação falhou") || msg.includes("Token ausente") ? 401 : 500;
    
    if (status === 401) {
      return errorResponse(msg, 401);
    }

    const fallback = safeRec("study_session", {
      reason: "Orquestrador indisponível — usando sessão guiada padrão.",
      priority: 5, confidence: 0.3,
    });
    return jsonResponse({
      success: false,
      error: msg,
      recommendation: fallback,
      alternatives: [], adaptiveState: null, rulesTrace: [],
      shadowMode: true, generatedAt,
    }, 200); // 200 para erros lógicos recuperáveis, mas 401 para segurança.
  }
});
