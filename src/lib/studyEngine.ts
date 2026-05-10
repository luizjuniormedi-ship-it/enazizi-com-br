import { supabase } from "@/integrations/supabase/client";
import type { CoreDataResult } from "@/hooks/useCoreData";
import { adjustPlanByApprovalScore, getAdaptiveMode, type PlanWeights, type AdaptiveMode } from "./approvalScoreWeights";
import { adjustNewTopicsByLock, type ContentLockStatus } from "@/hooks/useContentLock";
import { retrievability as fsrsRetrievability, State as FsrsState } from "./fsrs";
import type { StudyTaskType, StudyObjective } from "./studyContext";
import { getExamProfile, getMergedExamProfile, applyExamModifiers, type ExamProfile } from "./examProfiles";
import { fetchCurriculumForEngine, fetchAllCurriculumTopics } from "./curriculumBridge";
import { saveStudyEngineSnapshot } from "./dualWrite";
import { generateLegacyReviewQueue, type LegacyReviewItem } from "./legacyReviewQueue";
import {
  loadActiveRecoveryRun, startRecoveryRun, endRecoveryRun,
  updateRecoveryPhase, logRecoveryEvent, type ActiveRecoveryRun,
} from "./recoveryPersistence";

export type RecommendationType = "review" | "practice" | "clinical" | "new" | "error_review" | "simulado" | "chronicle";
export type TargetModule = "tutor" | "questoes" | "flashcards" | "plantao" | "anamnese" | "simulado" | "cronograma" | "banco-erros" | "cronicas" | "tutor-v2";

export interface StudyRecommendation {
  id: string;
  type: RecommendationType;
  topic: string;
  specialty: string;
  subtopic?: string;
  priority: number; // 0-100
  reason: string;
  targetModule: TargetModule;
  targetPath: string;
  estimatedMinutes: number;
  difficulty?: string;
  objective?: StudyObjective;
  /** Category tag for anti-duplicate grouping */
  _groupKey?: string;
  /** Canonical source table for direct DB updates */
  sourceTable?: string;
  /** Canonical record ID in sourceTable (oldest pending review for grouped reviews) */
  sourceRecordId?: string;
  /** FSRS card ID when applicable */
  fsrsCardId?: string;
  /** Error bank ID when applicable */
  errorBankId?: string;
  /** Daily plan task ID when applicable */
  dailyPlanTaskId?: string;
  /** Number of pending reviews for this topic (grouped) */
  pendingCount?: number;
  /** All pending review IDs for this topic (oldest first) */
  pendingReviewIds?: string[];
  /** Next scheduled review date after current */
  nextReviewDate?: string;
  /** Coverage → Study Engine Bridge (Fase 1.4): explicabilidade do boost */
  coverageBoostApplied?: number;
  coverageBoostScore?: number;
  coverageBoostLevel?: "none" | "low" | "medium" | "high" | "critical";
  coverageBoostReason?: string;
  coverageBoostBreakdown?: {
    statusBoost: number;
    importanceBoost: number;
    incidenceBoost: number;
    pedagogyGapBoost: number;
    questionGapBoost: number;
  };
  /** Fase 1.5 — vínculo estrutural (preferido sobre matching textual). */
  subtopicId?: string | null;
  topicId?: string | null;
  specialtyId?: string | null;
  /** Como o coverage boost casou esta recomendação. */
  coverageBoostMatchMethod?: "subtopic_id" | "topic_id" | "name" | "none";
}

/** Heavy recovery phase (30-day progressive plan) */
export type HeavyRecoveryPhase = 1 | 2 | 3 | 4;

export interface HeavyRecoveryState {
  active: boolean;
  phase: HeavyRecoveryPhase;
  dayInRecovery: number;
  startedAt: string | null;
  /** Phase labels for UI */
  phaseLabel: string;
  phaseDescription: string;
  /** Max daily tasks per phase */
  maxTasks: number;
  /** Max new topics allowed */
  maxNewTopics: number;
  /** Progress % through 30-day plan */
  progressPercent: number;
}

const HEAVY_RECOVERY_PHASES: Record<HeavyRecoveryPhase, { label: string; description: string; maxTasks: number; maxNew: number }> = {
  1: { label: "Estabilização", description: "Parando o colapso — foco apenas em revisões críticas e erros recorrentes.", maxTasks: 4, maxNew: 0 },
  2: { label: "Limpeza Controlada", description: "Reduzindo pendências — revisões + questões leves.", maxTasks: 5, maxNew: 0 },
  3: { label: "Reativação", description: "Retomando o fluxo — liberação gradual de conteúdo.", maxTasks: 6, maxNew: 1 },
  4: { label: "Reintegração", description: "Voltando ao normal — remoção progressiva de restrições.", maxTasks: 7, maxNew: 2 },
};

function getHeavyRecoveryPhase(day: number): HeavyRecoveryPhase {
  if (day <= 7) return 1;
  if (day <= 15) return 2;
  if (day <= 23) return 3;
  return 4;
}
// NOTE: localStorage recovery bridge is now handled by recoveryPersistence.ts
// The HEAVY_RECOVERY_STORAGE_KEY constant and loadHeavyRecoveryStateLegacy()
// were removed here as dead code — migration bridge lives in recoveryPersistence.ts.

function buildHeavyRecoveryState(startedAt: string | null, active: boolean): HeavyRecoveryState {
  if (!active || !startedAt) {
    return { active: false, phase: 1, dayInRecovery: 0, startedAt: null, phaseLabel: "", phaseDescription: "", maxTasks: 8, maxNewTopics: 3, progressPercent: 0 };
  }
  const day = Math.max(1, Math.ceil((Date.now() - new Date(startedAt).getTime()) / 86400000));
  const phase = getHeavyRecoveryPhase(Math.min(day, 30));
  const config = HEAVY_RECOVERY_PHASES[phase];
  return {
    active: true, phase, dayInRecovery: day, startedAt,
    phaseLabel: config.label, phaseDescription: config.description,
    maxTasks: config.maxTasks, maxNewTopics: config.maxNew,
    progressPercent: Math.min(Math.round((day / 30) * 100), 100),
  };
}

/** Adaptive state exposed to Dashboard/Mission/Mentor */
export interface AdaptiveState {
  approvalScore: number;
  weights: PlanWeights;
  mode: AdaptiveMode;
  lockStatus: ContentLockStatus;
  lockReasons: string[];
  /** Human-readable explanation of current focus */
  focusReason: string;
  /** Memory pressure: 0-100 based on overdue FSRS + reviews */
  memoryPressure: number;
  /** Overdue review count */
  overdueCount: number;
  /** Recovery mode active — reduces load and prioritizes critical items */
  recoveryMode: boolean;
  /** Human-readable reason for recovery mode */
  recoveryReason: string;
  /** Heavy recovery mode — 30-day progressive recovery plan */
  heavyRecovery: HeavyRecoveryState;
}

export interface EngineResult {
  recommendations: StudyRecommendation[];
  adaptive: AdaptiveState;
}

interface EngineInput {
  userId: string;
  coreData?: CoreDataResult;
  recoveryEnabled?: boolean; // feature flag — false = skip DB persistence
  fsrsEnabled?: boolean;     // feature flag — false = use legacy review queue
  coveragePriorityBoostEnabled?: boolean; // Fase 1.4 — false = skip coverage→engine bridge
}

function id(prefix: string, idx: number) {
  return `${prefix}-${idx}`;
}

function cap(n: number, max = 100) {
  return Math.min(Math.max(Math.round(n), 0), max);
}

// ── Compute approval score (same logic as ApprovalScoreCard) ───
async function computeApprovalScore(userId: string, practiceData: any[], examData: any[], anamnesisData: any[], clinicalData: any[], domainMapFromCore?: CoreDataResult["domainMap"]): Promise<number> {
  let specialties: any[];
  if (domainMapFromCore) {
    specialties = domainMapFromCore;
  } else {
    const { data: domainData } = await supabase
      .from("medical_domain_map")
      .select("specialty, domain_score, questions_answered")
      .eq("user_id", userId);
    specialties = domainData || [];
  }

  const avgDomain = specialties.length > 0
    ? specialties.reduce((s, d) => s + (d.domain_score || 0), 0) / specialties.length
    : 0;

  const totalPractice = practiceData.length;
  const totalCorrect = practiceData.filter((a: any) => a.correct).length;
  const accuracy = totalPractice > 0 ? (totalCorrect / totalPractice) * 100 : 0;

  const volumeScore = Math.min((totalPractice / 500) * 100, 100);

  const activities = [
    totalPractice > 0,
    examData.length > 0,
    clinicalData.length > 0,
    anamnesisData.length > 0,
    false,
    false,
  ].filter(Boolean).length;
  const diversityScore = (activities / 6) * 100;

  return Math.round(
    accuracy * 0.35 +
    avgDomain * 0.25 +
    volumeScore * 0.20 +
    diversityScore * 0.20
  );
}

// ── Apply weights to limit slots per type ─────────────────────
function applyWeights(recs: StudyRecommendation[], weights: PlanWeights, maxTotal: number): StudyRecommendation[] {
  const slotReview = Math.max(1, Math.round(maxTotal * weights.reviewWeight));
  const slotQuestions = Math.max(1, Math.round(maxTotal * weights.questionsWeight));
  const slotClinical = Math.round(maxTotal * weights.practicalWeight);
  const slotNew = weights.maxNewTopics;

  const buckets: Record<string, number> = {
    review: 0, error_review: 0, practice: 0, clinical: 0, simulado: 0, new: 0, chronicle: 0,
  };
  const limits: Record<string, number> = {
    review: slotReview,
    error_review: slotQuestions,
    practice: slotQuestions,
    clinical: slotClinical,
    simulado: slotClinical,
    new: slotNew,
    chronicle: 1,
  };

  const result: StudyRecommendation[] = [];
  for (const rec of recs) {
    if (result.length >= maxTotal) break;
    const b = rec.type;
    if ((buckets[b] || 0) < (limits[b] || 2)) {
      result.push(rec);
      buckets[b] = (buckets[b] || 0) + 1;
    }
  }
  return result;
}

// ── Build focus reason ────────────────────────────────────────
function buildFocusReason(weights: PlanWeights, overdueCount: number, lockStatus: ContentLockStatus): string {
  if (lockStatus === "blocked") {
    return "Hoje o foco é revisão porque você tem muitas revisões atrasadas e precisa recuperar sua base.";
  }
  switch (weights.phase) {
    case "critico":
      return overdueCount > 5
        ? `Foco em revisões — ${overdueCount} revisões atrasadas e score abaixo de 50%.`
        : "Foco em revisões e correção de erros para recuperar sua base de conhecimento.";
    case "atencao":
      return "Hoje o sistema prioriza revisões e questões direcionadas para estabilizar seu desempenho.";
    case "competitivo":
      return "Hoje o sistema liberou simulados e prática clínica para refinar seu desempenho.";
    case "pronto":
      return "Fase final: simulados completos e cenários práticos para manter a prontidão.";
  }
}

// ── main engine ────────────────────────────────────────────────
export async function generateRecommendations({ userId, coreData, recoveryEnabled = true, fsrsEnabled = true, coveragePriorityBoostEnabled = true }: EngineInput): Promise<EngineResult> {
 try {
  const recs: StudyRecommendation[] = [];
  const cd = coreData; // optional pre-fetched data from useCoreData
  const resetAt = cd?.profile.last_study_plan_reset_at ?? null;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Individual queries with safe fallback — one failure never breaks the engine
  const safe = async <T>(fn: () => PromiseLike<{ data: T | null; error: any }>, label: string): Promise<T | null> => {
    try {
      const { data, error } = await fn();
      if (error) console.warn(`[StudyEngine] ${label}:`, error.message);
      return data;
    } catch (e) {
      console.warn(`[StudyEngine] ${label} failed silently:`, e);
      return null;
    }
  };

  // Queries that ALWAYS need to run (engine-exclusive with specific filters/joins)
  const [
    revisoesData,
    errorBankData,
    desempenhoData,
    temasData,
    fsrsDueData,
    mentorTargets,
    practicalExamData,
    responseTimeData,
    // Only query these if coreData not provided
    ...conditionalResults
  ] = await Promise.all([
    // Fase 1.6 — puxa IDs estruturais via join em temas_estudados
    safe(() => supabase
      .from("revisoes")
      .select("id, tema_id, data_revisao, status, prioridade, risco_esquecimento, temas_estudados(tema, especialidade, subtopic_id, topic_id, specialty_id)")
      .eq("user_id", userId)
      .eq("status", "pendente")
      .lte("data_revisao", new Date().toISOString().slice(0, 10))
      .or(`created_at.gt.${resetAt || "1900-01-01T00:00:00Z"},created_at.gte.${todayIso}`)
      .order("prioridade", { ascending: false })
      .limit(20), "revisoes"),
    safe(() => supabase
      .from("error_bank")
      .select("id, tema, subtema, vezes_errado, dominado, categoria_erro")
      .eq("user_id", userId)
      .eq("dominado", false)
      .or(`updated_at.gt.${resetAt || "1900-01-01T00:00:00Z"},updated_at.gte.${todayIso}`)
      .order("vezes_errado", { ascending: false })
      .limit(20), "error_bank"),
    // Performance unified view (read-only): combines error_bank + simulado + fsrs.
    // IMPORTANT — semantic filtering at source:
    //   • 'fsrs' rows have tema='fsrs' literal (no clinical topic) → exclude
    //   • 'error_bank' rows have taxa_acerto=0 hardcoded (not a measured rate) → exclude from "weak topics"
    //   • Only 'simulado' rows carry a real 0-100 accuracy signal per topic
    // Reshaped to keep backward-compatible structure with `temas_estudados` join.
    safe<any[]>(() => supabase
      .from("performance_unified" as any)
      .select("tema, subtema, taxa_acerto, questoes_feitas, source")
      .eq("user_id", userId)
      .eq("source", "simulado")
      .or(`data_registro.gt.${resetAt || "1900-01-01T00:00:00Z"},data_registro.gte.${todayIso}`)
      .order("taxa_acerto", { ascending: true })
      .limit(20)
      .then((res: any) => ({
        error: res.error,
        data: (res.data || [])
          .filter((r: any) => r.tema && r.tema !== "fsrs" && r.tema !== "desconhecido")
          .map((r: any) => ({
            tema_id: null,
            taxa_acerto: Number(r.taxa_acerto) || 0,
            questoes_feitas: r.questoes_feitas || 1,
            temas_estudados: { tema: r.tema, especialidade: r.subtema || "Geral" },
          })) as any[],
      })), "desempenho"),
    // temas_estudados — engine needs extra fields (data_estudo, status, dificuldade) not in coreData
    // Fase 1.6 — também traz IDs estruturais para encadear nas recs de weak topics
    safe(() => supabase
      .from("temas_estudados")
      .select("id, tema, especialidade, data_estudo, status, dificuldade, subtopic_id, topic_id, specialty_id")
      .eq("user_id", userId)
      .or(`created_at.gt.${resetAt || "1900-01-01T00:00:00Z"},created_at.gte.${todayIso}`)
      .order("data_estudo", { ascending: false })
      .limit(50), "temas"),
    // FSRS query — only when flag ON
    ...(fsrsEnabled ? [
      safe(() => supabase
        .from("fsrs_cards")
        .select("id, card_type, card_ref_id, stability, difficulty, state, due, lapses")
        .eq("user_id", userId)
        .lte("due", new Date().toISOString())
        .or(`updated_at.gt.${resetAt || "1900-01-01T00:00:00Z"},updated_at.gte.${todayIso}`)
        .order("due", { ascending: true })
        .limit(30), "fsrs"),
    ] : [
      Promise.resolve(null), // placeholder so array indices stay correct
    ]),
    safe(() => supabase
      .from("mentor_theme_plan_targets")
      .select("plan_id")
      .eq("target_id", userId)
      , "mentor_targets"),
    safe(() => supabase
      .from("practical_exam_results")
      .select("final_score, specialty, scores_json, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10), "practical_exams"),
    // Response time per topic (for priority boost)
    // NOTE: performance_unified does not expose tempo_gasto — kept on legacy
    // table to preserve behavior. Returns empty when legacy table is empty.
    safe(() => supabase
      // @deprecated-source — `desempenho_questoes` é tabela legado (0 escritas em 30d).
      // Fonte viva: `performance_unified` (já lida em outro ponto deste motor).
      // Mantida apenas por compatibilidade de leitura adicional.
      .from("desempenho_questoes")
      .select("tempo_gasto, temas_estudados(tema)")
      .eq("user_id", userId)
      .not("tempo_gasto", "is", null)
      .order("created_at", { ascending: false })
      .limit(200), "response_times"),
    // Conditional: only fetch if no coreData
    ...(cd ? [] : [
      safe(() => supabase
        .from("practice_attempts")
        .select("correct, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200), "practice"),
      safe(() => supabase
        .from("exam_sessions")
        .select("id, score, total_questions, finished_at")
        .eq("user_id", userId)
        .eq("status", "finished")
        .order("finished_at", { ascending: false })
        .limit(10), "exams"),
      safe(() => supabase
        .from("anamnesis_results")
        .select("id, specialty, final_score, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10), "anamnesis"),
      safe(() => supabase
        .from("anamnesis_sessions")
        .select("id, specialty, final_score, created_at")
        .eq("user_id", userId)
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(10), "clinical_sim"),
      safe(() => supabase
        .from("profiles")
        .select("exam_date, target_exam, target_exams")
        .eq("user_id", userId)
        .single(), "profile"),
    ]),
  ]);

  // Resolve data: prefer coreData, fallback to direct queries
  const practiceData = cd ? cd.practiceAttempts : conditionalResults[0];
  const examData = cd ? cd.examSessions : conditionalResults[1];
  const anamnesisData = cd ? cd.anamnesisResults : conditionalResults[2];
  const clinicalSimData = cd ? null : conditionalResults[3]; // anamnesis_sessions not in coreData
  const profileData = cd
    ? { exam_date: cd.profile.exam_date, target_exam: cd.profile.target_exam, target_exams: cd.profile.target_exams }
    : conditionalResults[4];

  // ── Compute avg response time per topic (for priority boost) ──
  const responseTimeRows = (responseTimeData || []) as any[];
  const responseTimeByTopic = new Map<string, { total: number; count: number }>();
  for (const row of responseTimeRows) {
    const tema = row.temas_estudados?.tema;
    if (!tema || !row.tempo_gasto) continue;
    const entry = responseTimeByTopic.get(tema) || { total: 0, count: 0 };
    entry.total += row.tempo_gasto;
    entry.count += 1;
    responseTimeByTopic.set(tema, entry);
  }

  // ── Load mentor topics & exam dates if any active mentorships ──
  let mentorTopics: string[] = [];
  let mentorExamDate: Date | null = null;
  let mentorDaysUntilExam: number | null = null;
  const targetPlans = (mentorTargets || []) as any[];
  if (targetPlans.length > 0) {
    const planIds = [...new Set(targetPlans.map((t: any) => t.plan_id))];
    const activePlans = await safe(() => supabase
      .from("mentor_theme_plans")
      .select("id, exam_date")
      .in("id", planIds)
      .eq("status", "active"), "mentor_active_plans");
    if (activePlans && (activePlans as any[]).length > 0) {
      const activeIds = (activePlans as any[]).map((p: any) => p.id);
      const topicsData = await safe(() => supabase
        .from("mentor_theme_plan_topics")
        .select("topic")
        .in("plan_id", activeIds), "mentor_topics");
      mentorTopics = [...new Set((topicsData as any[] || []).map((t: any) => t.topic))];

      // Find closest mentor exam date
      for (const p of activePlans as any[]) {
        if (p.exam_date) {
          const d = new Date(p.exam_date);
          if (!mentorExamDate || d < mentorExamDate) mentorExamDate = d;
        }
      }
      if (mentorExamDate) {
        mentorDaysUntilExam = Math.ceil((mentorExamDate.getTime() - Date.now()) / 86400000);
      }
    }
  }

  // ── Compute approval score & weights ─────────────────────────
  const practiceAttempts = (practiceData || []) as any[];
  const exams = (examData || []) as any[];
  const anamnesisResults = (anamnesisData || []) as any[];
  const clinicalSims = (clinicalSimData || []) as any[];

  const approvalScore = await computeApprovalScore(userId, practiceAttempts, exams, anamnesisResults, clinicalSims, cd?.domainMap);
  const baseWeights = adjustPlanByApprovalScore(approvalScore);

  // ── Apply exam profile modifiers ─────────────────────────────
  const profile = profileData as any;
  const targetExams: string[] = profile?.target_exams;
  const examProfile = (Array.isArray(targetExams) && targetExams.length > 0)
    ? getMergedExamProfile(targetExams)
    : getExamProfile(profile?.target_exam);
  const weights = applyExamModifiers(baseWeights, examProfile) as PlanWeights;

  // ── Content Lock — compute inline for engine use ─────────────
  const today = new Date().toISOString().split("T")[0];
  const pendingReviews = (revisoesData || []) as any[];
  const overdueCount = pendingReviews.filter((r: any) => r.data_revisao <= today).length;
  const recentTotal = practiceAttempts.length;
  const recentErrors = practiceAttempts.filter((a: any) => !a.correct).length;
  const recentErrorRate = recentTotal > 0 ? (recentErrors / recentTotal) * 100 : 0;

  let lockStatus: ContentLockStatus = "allowed";
  const lockReasons: string[] = [];
  const blockHits = [overdueCount > 20, recentErrorRate > 70 && recentTotal >= 10].filter(Boolean).length;
  if (blockHits >= 2) {
    lockStatus = "blocked";
    if (overdueCount > 20) lockReasons.push(`${overdueCount} revisões atrasadas`);
    if (recentErrorRate > 70) lockReasons.push(`Taxa de erro ${Math.round(recentErrorRate)}%`);
  } else {
    const limitHits = [overdueCount >= 10, approvalScore < 50, recentErrorRate > 50 && recentTotal >= 5].filter(Boolean).length;
    if (limitHits >= 2) {
      lockStatus = "limited";
      if (overdueCount >= 10) lockReasons.push(`${overdueCount} revisões pendentes`);
      if (approvalScore < 50) lockReasons.push(`Score de aprovação ${approvalScore}%`);
      if (recentErrorRate > 50) lockReasons.push("Alto índice de erros recentes");
    }
  }
  // Adjust max new topics based on content lock
  weights.maxNewTopics = adjustNewTopicsByLock(weights.maxNewTopics, lockStatus);

  // ── FSRS memory pressure (only when FSRS enabled) ─────────────
  const fsrsDue = fsrsEnabled ? (fsrsDueData || []) as any[] : [];
  const memoryPressure = fsrsEnabled
    ? cap((overdueCount / 20) * 50 + (fsrsDue.length / 30) * 50, 100)
    : cap((overdueCount / 20) * 100, 100); // legacy: only revisoes count

  // ── Recovery mode detection ──────────────────────────────────
  const recoveryMode = overdueCount >= 15 || memoryPressure >= 70 ||
    (approvalScore < 35 && overdueCount >= 8);
  let recoveryReason = "";
  if (recoveryMode) {
    if (overdueCount >= 15) {
      recoveryReason = `Você tem ${overdueCount} revisões atrasadas. Priorizando o essencial para retomar o ritmo.`;
    } else if (memoryPressure >= 70) {
      recoveryReason = "Alta pressão de memória detectada. Reduzindo carga e focando em revisões críticas.";
    } else {
      recoveryReason = "Seu índice precisa de atenção. Vamos focar no que mais importa agora.";
    }
    weights.maxNewTopics = 0;
  }

  // ── Heavy Recovery mode — DB-persisted (30-day progressive plan) ──
  const heavyRecoveryThreshold =
    overdueCount >= 25 && memoryPressure >= 80 && approvalScore < 40;

  // Load from DB (includes localStorage migration bridge) — only when flag ON
  let activeRun: ActiveRecoveryRun | null = recoveryEnabled
    ? await loadActiveRecoveryRun(userId)
    : null;
  let heavyRecoveryStartedAt: string | null = activeRun?.mode === "heavy" ? activeRun.started_at : null;

  if (recoveryEnabled) {
    // Handle recovery normal persistence (fire-and-forget)
    if (recoveryMode && !activeRun) {
      const reason = recoveryReason;
      if (heavyRecoveryThreshold) {
        activeRun = await startRecoveryRun(userId, "heavy", reason);
        if (activeRun) {
          heavyRecoveryStartedAt = activeRun.started_at;
          logRecoveryEvent(activeRun.id, userId, "entered_heavy_recovery", reason, {
            overdueCount, memoryPressure, approvalScore,
          });
        }
      } else {
        activeRun = await startRecoveryRun(userId, "normal", reason);
        if (activeRun) {
          logRecoveryEvent(activeRun.id, userId, "entered_recovery", reason, {
            overdueCount, memoryPressure, approvalScore,
          });
        }
      }
    } else if (heavyRecoveryThreshold && activeRun?.mode === "normal") {
      // Upgrade normal → heavy
      await endRecoveryRun(activeRun.id, userId, "normal");
      activeRun = await startRecoveryRun(userId, "heavy", "Escalado para recuperação pesada");
      if (activeRun) {
        heavyRecoveryStartedAt = activeRun.started_at;
        logRecoveryEvent(activeRun.id, userId, "entered_heavy_recovery", "Escalado de normal para pesada", {
          overdueCount, memoryPressure, approvalScore,
        });
      }
    }

    // Check if heavy recovery should exit (day > 30 AND conditions improved)
    if (heavyRecoveryStartedAt && activeRun?.mode === "heavy") {
      const dayInHR = Math.ceil((Date.now() - new Date(heavyRecoveryStartedAt).getTime()) / 86400000);
      const currentPhase = getHeavyRecoveryPhase(Math.min(dayInHR, 30));

      // Update phase in DB if changed
      if (activeRun.phase !== currentPhase) {
        updateRecoveryPhase(activeRun.id, userId, currentPhase);
      }

      if (dayInHR > 30 && overdueCount < 10 && memoryPressure < 50 && approvalScore >= 40) {
        await endRecoveryRun(activeRun.id, userId, "heavy");
        heavyRecoveryStartedAt = null;
        activeRun = null;
      }
    }

    // Exit normal recovery if conditions improved
    if (activeRun?.mode === "normal" && !recoveryMode) {
      await endRecoveryRun(activeRun.id, userId, "normal");
      activeRun = null;
    }
  }
  // When recoveryEnabled=false, recoveryMode boolean still works (in-memory)
  // but no DB reads/writes happen — legacy behavior

  const heavyRecovery = buildHeavyRecoveryState(heavyRecoveryStartedAt, !!heavyRecoveryStartedAt);

  // Apply heavy recovery constraints
  if (heavyRecovery.active) {
    weights.maxNewTopics = heavyRecovery.maxNewTopics;
    if (heavyRecovery.phase <= 2) {
      weights.reviewWeight = Math.max(weights.reviewWeight, 0.65);
      weights.practicalWeight = Math.min(weights.practicalWeight, 0.05);
    } else if (heavyRecovery.phase === 3) {
      weights.reviewWeight = Math.max(weights.reviewWeight, 0.45);
      weights.practicalWeight = Math.min(weights.practicalWeight, 0.15);
    }
  }

  // ── Build adaptive state ─────────────────────────────────────
  const mode = getAdaptiveMode(weights.phase);
  const focusReason = heavyRecovery.active
    ? `Recuperação Pesada — Fase ${heavyRecovery.phase}: ${heavyRecovery.phaseLabel}. ${heavyRecovery.phaseDescription}`
    : recoveryMode
    ? recoveryReason
    : buildFocusReason(weights, overdueCount, lockStatus);
  const adaptive: AdaptiveState = {
    approvalScore,
    weights,
    mode,
    lockStatus,
    lockReasons,
    focusReason,
    memoryPressure,
    overdueCount,
    recoveryMode: recoveryMode || heavyRecovery.active,
    recoveryReason: heavyRecovery.active ? heavyRecovery.phaseDescription : recoveryReason,
    heavyRecovery,
  };

  // ── 1. Overdue / pending reviews (GROUPED BY TEMA) ────────────
  const seenTopics = new Set<string>();
  const addRec = (rec: StudyRecommendation) => {
    const groupKey = rec._groupKey || `${rec.type}:${rec.topic}`;
    if (seenTopics.has(groupKey)) return;
    seenTopics.add(groupKey);
    recs.push(rec);
  };

  // Fase 1.6 — índice tema→IDs estruturais a partir de temas_estudados (já com colunas novas)
  // Usado para enriquecer recs de review/weak topics quando a fonte legada não tinha ID.
  const temasArr = (temasData || []) as any[];
  const temaIdIndex = new Map<string, { subtopicId?: string | null; topicId?: string | null; specialtyId?: string | null }>();
  for (const t of temasArr) {
    if (!t?.tema) continue;
    const k = String(t.tema).trim().toLowerCase();
    const prev = temaIdIndex.get(k);
    // Prefere o registro que mais IDs tiver
    const score = (x?: string | null) => (x ? 1 : 0);
    const newScore = score(t.subtopic_id) + score(t.topic_id) + score(t.specialty_id);
    const prevScore = prev ? score(prev.subtopicId) + score(prev.topicId) + score(prev.specialtyId) : -1;
    if (newScore > prevScore) {
      temaIdIndex.set(k, {
        subtopicId: t.subtopic_id ?? null,
        topicId: t.topic_id ?? null,
        specialtyId: t.specialty_id ?? null,
      });
    }
  }

  // Group pending reviews by tema name
  const reviewsByTema = new Map<string, { reviews: any[]; spec: string }>();
  for (const rev of pendingReviews) {
    const tema = rev.temas_estudados?.tema || "Tema";
    const spec = rev.temas_estudados?.especialidade || "Geral";
    if (!reviewsByTema.has(tema)) {
      reviewsByTema.set(tema, { reviews: [], spec });
    }
    reviewsByTema.get(tema)!.reviews.push(rev);
  }

  // Sort each group by data_revisao ASC (oldest first)
  for (const [, group] of reviewsByTema) {
    group.reviews.sort((a: any, b: any) =>
      new Date(a.data_revisao).getTime() - new Date(b.data_revisao).getTime()
    );
  }

  // Build one recommendation per tema
  let revIdx = 0;
  const sortedTemas = [...reviewsByTema.entries()]
    .sort((a, b) => {
      // Sort by oldest review date ASC (most overdue first)
      const aOldest = new Date(a[1].reviews[0].data_revisao).getTime();
      const bOldest = new Date(b[1].reviews[0].data_revisao).getTime();
      return aOldest - bOldest;
    })
    .slice(0, 5);

  for (const [tema, { reviews, spec }] of sortedTemas) {
    const oldest = reviews[0];
    const isOverdue = oldest.data_revisao <= today;
    const basePriority = isOverdue ? 95 : 80;
    const riskBonus = oldest.risco_esquecimento === "alto" ? 5 : oldest.risco_esquecimento === "medio" ? 2 : 0;
    const phaseBonus = weights.phase === "critico" ? 5 : 0;
    const daysOverdue = isOverdue ? Math.max(0, Math.floor((Date.now() - new Date(oldest.data_revisao).getTime()) / 86400000)) : 0;
    const overdueBoost = daysOverdue > 3 ? 10 : 0;
    const pendingCount = reviews.length;
    const pendingReviewIds = reviews.map((r: any) => r.id);
    const nextReviewDate = reviews.length > 1 ? reviews[1].data_revisao : undefined;

    // Check FSRS card for this tema for priority boost
    const fsrsCard = fsrsDue.find((c: any) =>
      c.card_type === "tema" && (
        c.card_ref_id === oldest.tema_id ||
        (c.card_ref_id || "").toLowerCase().includes(tema.toLowerCase().slice(0, 10))
      )
    );
    const fsrsBoost = fsrsCard ? 5 : 0;

    const countLabel = pendingCount > 1 ? ` (${pendingCount} pendentes)` : "";

    // Fase 1.6 — IDs estruturais: 1º via join direto, 2º fallback no índice de temas_estudados
    const fromJoin = oldest.temas_estudados || {};
    const fromIndex = temaIdIndex.get(tema.trim().toLowerCase()) || {};
    const subtopicId = fromJoin.subtopic_id ?? fromIndex.subtopicId ?? null;
    const topicId = fromJoin.topic_id ?? fromIndex.topicId ?? null;
    const specialtyId = fromJoin.specialty_id ?? fromIndex.specialtyId ?? null;

    addRec({
      id: id("rev", revIdx),
      type: "review",
      topic: tema,
      specialty: spec,
      priority: cap(basePriority + riskBonus + phaseBonus + overdueBoost + fsrsBoost - revIdx),
      reason: isOverdue
        ? daysOverdue > 3
          ? `⚠️ Revisão de "${tema}" atrasada ${daysOverdue} dias${countLabel} — prioridade máxima!`
          : `Revisão atrasada de "${tema}"${countLabel} — risco de esquecer!`
        : `Revisão programada de "${tema}"${countLabel} para hoje.`,
      targetModule: "tutor-v2",
      targetPath: `/dashboard/tutor-v2?topic=${encodeURIComponent(tema)}&source=engine_review`,
      estimatedMinutes: 15,
      objective: "review",
      _groupKey: `review:${tema}`,
      sourceTable: "revisoes",
      sourceRecordId: oldest.id,
      fsrsCardId: fsrsCard?.id,
      pendingCount,
      pendingReviewIds,
      nextReviewDate,
      subtopicId,
      topicId,
      specialtyId,
    });
    revIdx++;
  }

  // ── 2. Error bank ────────────────────────────────────────────
  const errors = (errorBankData || []) as any[];
  const errorLimit = weights.phase === "critico" ? 5 : 3;

  // Aggressive priority: check if any topic has vezes_errado >= 5 with no mastery
  const criticalErrors = errors.filter((e: any) => e.vezes_errado >= 5);
  const hasCriticalBlock = criticalErrors.length > 0 && approvalScore < 50;

  for (let i = 0; i < Math.min(errors.length, errorLimit); i++) {
    const err = errors[i];
    // Smoothed aggressive boost: cap individual boosts to avoid wild oscillation
    const errorBoost = Math.min(err.vezes_errado >= 3 ? 20 : 0, 20);
    const scoreBoost = approvalScore < 40 ? 10 : 0;
    const priority = cap(70 + Math.min(err.vezes_errado * 3, 15) - i * 2 + (weights.phase === "critico" ? 8 : 0) + errorBoost + scoreBoost);
    // Debug: log canonical ID injection for errors
    console.log("[StudyEngine] Error rec:", { tema: err.tema, errorId: err.id });

    // Fase 1.6 — error_bank não tem IDs estruturais; tenta via índice de temas_estudados
    const errIds = temaIdIndex.get(String(err.tema || "").trim().toLowerCase()) || {};

    addRec({
      id: id("err", i),
      type: "error_review",
      topic: err.tema,
      specialty: err.subtema || "Geral",
      subtopic: err.subtema || undefined,
      priority,
      reason: err.vezes_errado >= 5
        ? `⚠️ "${err.tema}" errado ${err.vezes_errado}x — bloqueio ativo até domínio.`
        : `Você errou "${err.tema}" ${err.vezes_errado}x. Revise para fixar.`,
      targetModule: "tutor-v2",
      targetPath: `/dashboard/tutor-v2?topic=${encodeURIComponent(err.tema)}&source=engine_error&errorId=${err.id}`,
      estimatedMinutes: 10,
      objective: "correction",
      difficulty: err.vezes_errado >= 5 ? "facil" : "intermediario",
      _groupKey: `error:${err.tema}`,
      sourceTable: "error_bank",
      sourceRecordId: err.id,
      errorBankId: err.id,
      subtopicId: errIds.subtopicId ?? null,
      topicId: errIds.topicId ?? null,
      specialtyId: errIds.specialtyId ?? null,
    });
  }

  // ── 3. Low-accuracy topics ───────────────────────────────────
  const weakTopics = (desempenhoData || []).filter((d: any) => d.taxa_acerto < 60 && d.questoes_feitas >= 3) as any[];
  for (let i = 0; i < Math.min(weakTopics.length, 3); i++) {
    const w = weakTopics[i];
    const tema = w.temas_estudados?.tema || "Tema";
    const spec = w.temas_estudados?.especialidade || "Geral";
    // Fase 1.6 — IDs estruturais via índice tema→IDs montado a partir de temas_estudados
    const ids = temaIdIndex.get(tema.trim().toLowerCase()) || {};
    addRec({
      id: id("weak", i),
      type: "practice",
      topic: tema,
      specialty: spec,
      priority: cap(65 - i * 3),
      reason: `Acerto de ${Math.round(w.taxa_acerto)}% em "${tema}". Pratique mais questões.`,
      targetModule: "questoes",
      targetPath: "/dashboard/simulados",
      estimatedMinutes: 20,
      objective: "reinforcement",
      difficulty: w.taxa_acerto < 40 ? "facil" : "intermediario",
      _groupKey: `practice:${tema}`,
      subtopicId: ids.subtopicId ?? null,
      topicId: ids.topicId ?? null,
      specialtyId: ids.specialtyId ?? null,
    });
  }

  // ── 4. Clinical practice ─────────────────────────────────────
  const totalPractice = practiceAttempts.length;
  const totalCorrect = practiceAttempts.filter((a: any) => a.correct).length;
  const overallAccuracy = totalPractice > 0 ? (totalCorrect / totalPractice) * 100 : 0;
  const clinicalCount = clinicalSims.length;
  const anamnesisCount = anamnesisResults.length;

  // Adaptive clinical priority based on phase
  const clinicalPriority = weights.phase === "pronto" ? 85 : weights.phase === "competitivo" ? 70 : weights.phase === "atencao" ? 55 : 40;

  // Detect theory-strong but practice-weak users
  const avgPracticalScore = [...clinicalSims, ...anamnesisResults]
    .map((r: any) => r.final_score || 0)
    .reduce((sum, s, _, arr) => sum + s / (arr.length || 1), 0);
  const practiceGap = overallAccuracy > 60 && avgPracticalScore < 60;

  if (practiceGap || weights.phase === "competitivo" || weights.phase === "pronto") {
    addRec({
      id: "clinical-gap",
      type: "clinical",
      topic: "Simulação Clínica",
      specialty: "Prática Clínica",
      priority: practiceGap ? clinicalPriority + 10 : clinicalPriority,
      reason: practiceGap
        ? "Bom desempenho teórico mas prática clínica fraca. Treine cenários!"
        : weights.phase === "pronto"
        ? "Fase final: pratique casos clínicos para consolidar."
        : `Boa acurácia (${Math.round(overallAccuracy)}%). Hora de praticar no plantão!`,
      targetModule: "plantao",
      targetPath: "/dashboard/simulacao-clinica",
      estimatedMinutes: 30,
      objective: "practice",
      difficulty: weights.phase === "pronto" ? "difícil" : "intermediário",
    });
  }

  if ((overallAccuracy >= 50 || weights.phase !== "critico") && anamnesisCount < 5) {
    addRec({
      id: "anamnesis-gap",
      type: "clinical",
      topic: "Treino de Anamnese",
      specialty: "Semiologia",
      priority: practiceGap ? clinicalPriority + 5 : clinicalPriority - 5,
      reason: "Treine a coleta de história clínica com paciente virtual.",
      targetModule: "anamnese",
      targetPath: "/dashboard/anamnese",
      estimatedMinutes: 25,
      objective: "practice",
    });
  }

  // ── 4b. OSCE Practical Exam — smart triggers ─────────────────
  const practicalExams = (practicalExamData || []) as any[];
  // profile already loaded above as `profile`
  const examDate = profile?.exam_date ? new Date(profile.exam_date) : null;
  const daysUntilExam = examDate ? Math.ceil((examDate.getTime() - Date.now()) / 86400000) : null;

  const recentPractical = practicalExams.slice(0, 5);
  const hasLowPracticalScore = recentPractical.length > 0 &&
    recentPractical.some((r: any) => (r.final_score || 0) < 5);
  const hasConductError = recentPractical.some((r: any) => {
    const scores = r.scores_json as any;
    return scores && (scores.conduta < 5 || scores.priorizacao < 5);
  });
  const avgPracticalExamScore = recentPractical.length > 0
    ? recentPractical.reduce((s: number, r: any) => s + (r.final_score || 0), 0) / recentPractical.length
    : null;

  const shouldRecommendOSCE = hasConductError || hasLowPracticalScore ||
    (daysUntilExam !== null && daysUntilExam <= 30) ||
    weights.phase === "competitivo" || weights.phase === "pronto";

  if (shouldRecommendOSCE) {
    let oscePriority = clinicalPriority;
    let osceReason = "Pratique decisões clínicas sob pressão com a Prova Prática.";

    if (hasConductError) {
      oscePriority = cap(clinicalPriority + 15);
      osceReason = "⚠️ Erro de conduta detectado — pratique decisões clínicas na Prova Prática.";
    } else if (hasLowPracticalScore && avgPracticalExamScore !== null) {
      oscePriority = cap(clinicalPriority + 10);
      osceReason = `Nota prática ${avgPracticalExamScore.toFixed(1)}/10 — reforce com mais simulações OSCE.`;
    } else if (daysUntilExam !== null && daysUntilExam <= 14) {
      oscePriority = cap(clinicalPriority + 20);
      osceReason = `Prova em ${daysUntilExam} dias! Treine decisões clínicas sob pressão.`;
    } else if (daysUntilExam !== null && daysUntilExam <= 30) {
      oscePriority = cap(clinicalPriority + 10);
      osceReason = `Prova em ${daysUntilExam} dias — inclua provas práticas na rotina.`;
    }

    addRec({
      id: "osce-practical",
      type: "clinical",
      topic: "Prova Prática (OSCE)",
      specialty: "Prática Clínica",
      priority: oscePriority,
      reason: osceReason,
      targetModule: "plantao",
      targetPath: "/dashboard/prova-pratica",
      estimatedMinutes: 25,
      objective: "practice",
      difficulty: weights.phase === "pronto" ? "difícil" : "intermediário",
      _groupKey: "clinical:osce",
    });
  }

  // ── 5. Simulado readiness ────────────────────────────────────
  const simuladoPriority = weights.phase === "pronto" ? 90 : weights.phase === "competitivo" ? 65 : 45;
  if (overallAccuracy >= 55 && totalPractice >= 20) {
    addRec({
      id: "simulado-ready",
      type: "simulado",
      topic: "Simulado Completo",
      specialty: "Geral",
      priority: simuladoPriority,
      reason: weights.phase === "pronto"
        ? "Fase de prova: faça simulados completos regularmente."
        : `Com ${Math.round(overallAccuracy)}% de acurácia, teste em condições reais.`,
      targetModule: "simulado",
      targetPath: "/dashboard/simulados",
      estimatedMinutes: 60,
      objective: "practice",
      difficulty: weights.phase === "pronto" || weights.phase === "competitivo" ? "difícil" : "médio",
    });
  }

  // ── 5b. Chronicle recommendation — complex/error topics ──────
  const topErrorTopic = errors.length > 0 ? errors[0] : null;
  const chroniclePriority = weights.phase === "competitivo" || weights.phase === "pronto" ? 60 : 45;
  if (topErrorTopic && topErrorTopic.vezes_errado >= 3) {
    addRec({
      id: "chronicle-error",
      type: "chronicle",
      topic: topErrorTopic.tema,
      specialty: topErrorTopic.subtema || topErrorTopic.tema,
      priority: chroniclePriority,
      reason: `Crônica imersiva sobre "${topErrorTopic.tema}" para fixar conceito errado ${topErrorTopic.vezes_errado}x.`,
      targetModule: "cronicas",
      targetPath: "/dashboard/cronicas",
      estimatedMinutes: 20,
      objective: "reinforcement",
      _groupKey: `chronicle:${topErrorTopic.tema}`,
    });
  } else if (overallAccuracy >= 60 && (weights.phase === "competitivo" || weights.phase === "pronto")) {
    addRec({
      id: "chronicle-practice",
      type: "chronicle",
      topic: "Caso Clínico Imersivo",
      specialty: "Prática Clínica",
      priority: chroniclePriority - 5,
      reason: "Aprofunde com uma crônica médica e transforme em simulação prática.",
      targetModule: "cronicas",
      targetPath: "/dashboard/cronicas",
      estimatedMinutes: 20,
      objective: "practice",
      _groupKey: "chronicle:general",
    });
  }

  // Aggressive: if any topic has vezes_errado >= 5 and accuracy < 50%, block new topics
  if (!hasCriticalBlock) {
    const temas = (temasData || []) as any[];
    const studiedSpecialties = new Set(temas.map((t: any) => t.especialidade));
    const CORE_SPECIALTIES = [
      "Clínica Médica", "Cirurgia Geral", "Pediatria", "Ginecologia e Obstetrícia",
      "Medicina Preventiva", "Urgência e Emergência", "Saúde Mental",
    ];
    const unexplored = CORE_SPECIALTIES.filter((s) => !studiedSpecialties.has(s));

    const isNewUser = temas.length === 0 && (practiceAttempts as any[]).length === 0;
    const maxNew = isNewUser ? Math.max(weights.maxNewTopics, 3) : weights.maxNewTopics;
    for (let i = 0; i < Math.min(unexplored.length, maxNew); i++) {
      addRec({
        id: id("new", i),
        type: "new",
        topic: unexplored[i],
        specialty: unexplored[i],
        priority: cap(isNewUser ? 80 - i * 5 : 35 - i * 5),
        reason: `Você ainda não estudou "${unexplored[i]}". Comece pelo tutor!`,
        targetModule: "tutor",
        targetPath: "/dashboard/mentor",
        estimatedMinutes: 30,
        objective: "new_content",
      });
    }

    // ── 6b. Curriculum gap filler — using curriculum bridge (new tables with legacy fallback) ──
    const studiedTopicNames = new Set(temas.map((t: any) => (t.tema || "").toLowerCase()));
    const userBancas = Array.isArray(targetExams) && targetExams.length > 0 ? targetExams : ["ENARE"];
    const primaryBanca = userBancas[0];

    const curriculumItems = await fetchCurriculumForEngine(primaryBanca, 6, 80);

    const curriculumGaps: { topic: string; specialty: string; subtema: string; bancaPeso: number; prioridade: number; incidencia: string; subtopicId?: string | null; topicId?: string | null; specialtyId?: string | null }[] = [];
    for (const item of curriculumItems) {
      const subLower = (item.subtema || "").toLowerCase();
      const temaLower = (item.tema || "").toLowerCase();
      const alreadyStudied = studiedTopicNames.has(subLower) ||
        studiedTopicNames.has(temaLower) ||
        [...studiedTopicNames].some(st => st.includes(subLower.slice(0, 12)) || subLower.includes(st.slice(0, 12)));
      if (!alreadyStudied) {
        curriculumGaps.push({
          topic: item.subtema,
          specialty: item.especialidade,
          subtema: item.tema,
          bancaPeso: item.bancaPeso,
          prioridade: item.prioridade_base,
          incidencia: item.incidencia_geral,
          subtopicId: item.subtopicId ?? null,
          topicId: item.topicId ?? null,
          specialtyId: item.specialtyId ?? null,
        });
      }
    }
    // Sort by banca weight desc, then priority desc
    curriculumGaps.sort((a, b) => (b.bancaPeso - a.bancaPeso) || (b.prioridade - a.prioridade));

    // Add up to 3 curriculum gap recs with banca-aware priority
    for (let i = 0; i < Math.min(curriculumGaps.length, 3); i++) {
      const gap = curriculumGaps[i];
      const bancaBoost = gap.bancaPeso >= 9 ? 10 : gap.bancaPeso >= 7 ? 5 : 0;
      const incidenciaBoost = gap.incidencia === "altissima" ? 8 : gap.incidencia === "alta" ? 4 : 0;
      addRec({
        id: id("curriculum", i),
        type: "new",
        topic: gap.topic,
        specialty: gap.specialty,
        subtopic: gap.subtema,
        priority: cap(42 + bancaBoost + incidenciaBoost - i * 3),
        reason: `📚 ${gap.topic} (${gap.specialty} → ${gap.subtema}) — peso ${gap.bancaPeso}/10 na ${userBancas[0]}. Cobertura obrigatória.`,
        targetModule: "tutor",
        targetPath: "/dashboard/mentor",
        estimatedMinutes: 25,
        objective: "new_content",
        _groupKey: `curriculum:${gap.topic}`,
        subtopicId: gap.subtopicId ?? null,
        topicId: gap.topicId ?? null,
        specialtyId: gap.specialtyId ?? null,
      });
    }
  }

  // ── FSRS flashcard reviews (only when FSRS ON) ────────────────
  if (fsrsEnabled) {
    const flashcardDue = fsrsDue.filter((c: any) => c.card_type === "flashcard");
    if (flashcardDue.length > 0) {
      flashcardDue.sort((a: any, b: any) => a.stability - b.stability);
      const urgency = flashcardDue.length > 10 ? "alta" : flashcardDue.length > 3 ? "moderada" : "normal";
      addRec({
        id: "fsrs-flashcards",
        type: "review",
        topic: `${flashcardDue.length} Flashcards`,
        specialty: "Revisão Espaçada",
        priority: cap(85 + Math.min(flashcardDue.length, 10)),
        reason: flashcardDue.length > 5
          ? `${flashcardDue.length} flashcards pendentes — prioridade ${urgency}!`
          : `${flashcardDue.length} flashcard(s) pronto(s) para revisão.`,
        targetModule: "flashcards",
        targetPath: "/dashboard/flashcards",
        estimatedMinutes: Math.max(5, flashcardDue.length * 2),
        objective: "review",
      });
    }
  } else {
    // ── Legacy review queue (when FSRS OFF) ─────────────────────
    const legacyQueue = await generateLegacyReviewQueue(userId);
    // Add legacy review items that aren't already covered by the revisoes section
    const existingReviewTopics = new Set(recs.filter(r => r.type === "review").map(r => r.topic));
    for (let i = 0; i < Math.min(legacyQueue.length, 5); i++) {
      const item = legacyQueue[i];
      if (existingReviewTopics.has(item.topic)) continue;
      addRec({
        id: `legacy-rev-${i}`,
        type: "review",
        topic: item.topic,
        specialty: item.specialty,
        subtopic: item.subtopic,
        priority: item.priority,
        reason: item.source === "error"
          ? `Reforço: "${item.topic}" precisa de revisão (erro recorrente).`
          : item.daysOverdue > 3
          ? `⚠️ Revisão de "${item.topic}" atrasada ${item.daysOverdue} dias.`
          : `Revisão pendente de "${item.topic}".`,
        targetModule: "tutor",
        targetPath: "/dashboard/mentor",
        estimatedMinutes: 15,
        objective: "review",
        _groupKey: `legacy:${item.topic}`,
      });
    }
  }

  // ── Curriculum-based priority boost (using curriculum bridge) ────
  const allCurriculumTopics = await fetchAllCurriculumTopics();
  const matrixSet = new Set(allCurriculumTopics.map(m => (m.subtema || "").toLowerCase()));
  const matrixTemaSet = new Set(allCurriculumTopics.map(m => (m.tema || "").toLowerCase()));
  const CURRICULUM_BOOST = 8;
  for (const rec of recs) {
    const topicLower = (rec.topic || "").toLowerCase();
    const isInMatrix = matrixSet.has(topicLower) ||
      matrixTemaSet.has(topicLower) ||
      [...matrixSet].some(m => m.includes(topicLower.slice(0, 10)) || topicLower.includes(m.slice(0, 10)));
    if (isInMatrix) {
      rec.priority = cap(rec.priority + CURRICULUM_BOOST);
      if (!rec.reason.includes("📚")) {
        rec.reason = `📚 ${rec.reason}`;
      }
    }
  }

  // ── Coverage gap signal (garantia de cobertura curricular) ────
  // Boost adicional para temas REQUIRED (alta prioridade/incidência) que o aluno
  // ainda não estudou. Não cria recs novos — só reforça os existentes que casam.
  // Fonte: getCoverageStatus(userId) — leitura de curriculum_matrix + temas_estudados.
  try {
    const { getCoverageStatus } = await import("./coverageEngine");
    const { STUDY_ENGINE_CALIBRATION } = await import("./studyEngineCalibration");
    const coverage = await getCoverageStatus(userId);
    const COVERAGE_GAP_BOOST = STUDY_ENGINE_CALIBRATION.coverageGapBoost;
    if (coverage.criticalGaps.length > 0) {
      const gapNames = new Set(
        coverage.criticalGaps.flatMap((g) => [
          (g.subtema || "").toLowerCase(),
          (g.tema || "").toLowerCase(),
        ]).filter(Boolean)
      );
      for (const rec of recs) {
        const t = (rec.topic || "").toLowerCase();
        const matches = gapNames.has(t) ||
          [...gapNames].some((g) => g.length >= 6 && (g.includes(t.slice(0, 10)) || t.includes(g.slice(0, 10))));
        if (matches) {
          rec.priority = cap(rec.priority + COVERAGE_GAP_BOOST);
          if (!rec.reason.includes("🎯")) {
            rec.reason = `🎯 ${rec.reason}`;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[StudyEngine] coverage gap signal skipped:", e);
  }

  // ── Coverage → Study Engine Bridge (Fase 1.4 + 1.5) ───────────
  // Camada complementar: usa a auditoria pedagógica (status + importance +
  // gap pedagógico + gap de questões + incidência) para empurrar levemente
  // assuntos muito cobrados e mal cobertos. Aplicação:
  //   bonus = round(boostScore * 0.15)
  // Defensivo: feature flag, try/catch total, dados ausentes → skip.
  // Mandatory rules (recovery, FSRS, missões mínimas) já foram aplicadas antes.
  // Fase 1.5: matching em 3 níveis (subtopic_id → topic_id → name) com
  // contadores de método de match expostos em window para o painel admin.
  if (coveragePriorityBoostEnabled) {
    try {
      const [{ supabase: sb }, boostMod] = await Promise.all([
        import("@/integrations/supabase/client"),
        import("./coveragePriorityBoost"),
      ]);
      const { computeCoverageBoost, appliedBoostFromScore } = boostMod;
      const { classifyCoverage } = await import("./coverageRules");

      // Carrega tudo em queries enxutas (reusa as mesmas tabelas do audit).
      const [{ data: subRows }, { data: weights }, { data: links }, { data: mats }, { data: flashes }] =
        await Promise.all([
          sb.from("curriculum_subtopics" as any).select("id, nome, ativo, topic_id").eq("ativo", true),
          sb.from("curriculum_weights" as any).select("subtopic_id, banca, importance_level, peso"),
          sb.from("question_topic_links" as any).select("subtopic_id, match_confidence"),
          sb.from("study_materials" as any).select("subtopic_id").eq("is_global", true).eq("ativo", true),
          sb.from("flashcards" as any).select("subtopic_id").eq("is_global", true),
        ]);

      const wBy = new Map<string, any[]>();
      for (const w of (weights ?? []) as any[]) {
        if (!w?.subtopic_id) continue;
        const arr = wBy.get(w.subtopic_id) ?? [];
        arr.push(w);
        wBy.set(w.subtopic_id, arr);
      }
      const qBy = new Map<string, number>();
      const qStrongBy = new Map<string, number>();
      for (const l of (links ?? []) as any[]) {
        if (!l?.subtopic_id) continue;
        qBy.set(l.subtopic_id, (qBy.get(l.subtopic_id) ?? 0) + 1);
        if (Number(l.match_confidence) >= 0.85) {
          qStrongBy.set(l.subtopic_id, (qStrongBy.get(l.subtopic_id) ?? 0) + 1);
        }
      }
      const mBy = new Map<string, number>();
      for (const m of (mats ?? []) as any[]) {
        if (!m?.subtopic_id) continue;
        mBy.set(m.subtopic_id, (mBy.get(m.subtopic_id) ?? 0) + 1);
      }
      const fBy = new Map<string, number>();
      for (const f of (flashes ?? []) as any[]) {
        if (!f?.subtopic_id) continue;
        fBy.set(f.subtopic_id, (fBy.get(f.subtopic_id) ?? 0) + 1);
      }

      // Mapas estruturais (Fase 1.5):
      //   byId         → chave principal: subtopic_id
      //   byTopicId    → fallback estrutural: agrega o maior boost por topic
      //   byName       → fallback textual legado (lowercase)
      type BoostEntry = ReturnType<typeof computeCoverageBoost>;
      const byId = new Map<string, BoostEntry>();
      const byTopicId = new Map<string, BoostEntry>();
      const byName = new Map<string, BoostEntry>();
      const importanceOrder = ["muito_cobrado", "cobrado", "pouco_cobrado", "raro"] as const;

      for (const s of (subRows ?? []) as any[]) {
        const ws = wBy.get(s.id) ?? [];
        let importance: any = null;
        for (const lvl of importanceOrder) {
          if (ws.some((w: any) => w.importance_level === lvl)) { importance = lvl; break; }
        }
        const qCount = qBy.get(s.id) ?? 0;
        const qStrong = qStrongBy.get(s.id) ?? 0;
        const matCount = mBy.get(s.id) ?? 0;
        const flashCount = fBy.get(s.id) ?? 0;
        const verdict = classifyCoverage({
          questionsCount: Math.max(qStrong, Math.floor(qCount * 0.7)),
          bancaCoverageCount: ws.length,
          materialsCount: matCount,
          flashcardsCount: flashCount,
          importanceLevel: importance,
        });
        const result = computeCoverageBoost({
          status: verdict.status,
          importanceLevel: importance,
          questionsCount: qCount,
          strongQuestionsCount: qStrong,
          materialsCount: matCount,
          flashcardsCount: flashCount,
          microtopicsCount: 0,
          bancaCoverageCount: ws.length,
        });
        if (result.boostScore <= 0) continue;
        // Estrutural por subtopic_id
        byId.set(s.id, result);
        // Agrega no topic_id mantendo o maior boost
        if (s.topic_id) {
          const prev = byTopicId.get(s.topic_id);
          if (!prev || result.boostScore > prev.boostScore) {
            byTopicId.set(s.topic_id, result);
          }
        }
        // Textual (legado)
        const key = String(s.nome || "").trim().toLowerCase();
        if (key) byName.set(key, result);
      }

      if (byId.size > 0 || byName.size > 0) {
        let touched = 0;
        const matchStats = { subtopic_id: 0, topic_id: 0, name: 0, none: 0 };
        for (const rec of recs) {
          let entry: BoostEntry | undefined;
          let method: "subtopic_id" | "topic_id" | "name" | "none" = "none";

          // 1) Match estrutural por subtopic_id (preferido)
          if (rec.subtopicId && byId.has(rec.subtopicId)) {
            entry = byId.get(rec.subtopicId);
            method = "subtopic_id";
          }
          // 2) Match estrutural por topic_id
          else if (rec.topicId && byTopicId.has(rec.topicId)) {
            entry = byTopicId.get(rec.topicId);
            method = "topic_id";
          }
          // 3) Fallback textual legado
          else {
            const t = (rec.topic || "").toLowerCase().trim();
            const sub = (rec.subtopic || "").toLowerCase().trim();
            entry = (sub && byName.get(sub)) || byName.get(t);
            if (!entry && t.length >= 6) {
              for (const [k, v] of byName) {
                if (k.includes(t.slice(0, 10)) || t.includes(k.slice(0, 10))) {
                  entry = v;
                  break;
                }
              }
            }
            if (entry) method = "name";
          }

          if (!entry) {
            matchStats.none++;
            rec.coverageBoostMatchMethod = "none";
            continue;
          }
          const applied = appliedBoostFromScore(entry.boostScore);
          if (applied <= 0) {
            matchStats.none++;
            rec.coverageBoostMatchMethod = "none";
            continue;
          }
          rec.priority = cap(rec.priority + applied);
          rec.coverageBoostApplied = applied;
          rec.coverageBoostScore = entry.boostScore;
          rec.coverageBoostLevel = entry.boostLevel;
          rec.coverageBoostReason = entry.boostReason;
          rec.coverageBoostBreakdown = entry.boostBreakdown;
          rec.coverageBoostMatchMethod = method;
          matchStats[method]++;
          touched++;
          if (entry.boostLevel === "critical" || entry.boostLevel === "high") {
            if (!rec.reason.includes("⚡")) {
              rec.reason = `⚡ ${rec.reason}`;
            }
          }
        }
        if (touched > 0) {
          console.log(
            `[StudyEngine] coverage boost: ${touched} recs touched — by_subtopic_id=${matchStats.subtopic_id}, by_topic_id=${matchStats.topic_id}, by_name=${matchStats.name}, no_match=${matchStats.none}`,
          );
        }
        // Expor stats para o painel admin (read-only)
        try {
          (globalThis as any).__coverageBoostMatchStats = {
            ...matchStats,
            touched,
            timestamp: Date.now(),
          };
        } catch { /* noop */ }
      }
    } catch (e) {
      console.warn("[StudyEngine] coverage priority boost skipped:", e);
    }
  }

  // ── Monthly question goal signal (volume mínimo garantido) ────
  // Quando o aluno está atrasado na meta mensal de questões, sobe a prioridade
  // de qualquer rec do tipo "questões/prática" para forçar volume.
  // Fonte: getMonthlyGoalStatus — leitura de practice_attempts + study_goal_monthly.
  try {
    const { getMonthlyGoalStatus } = await import("./monthlyGoalEngine");
    const { STUDY_ENGINE_CALIBRATION } = await import("./studyEngineCalibration");
    const goal = await getMonthlyGoalStatus(userId);
    if (goal.paceStatus === "behind") {
      const PACE_BEHIND_BOOST = STUDY_ENGINE_CALIBRATION.monthlyGoalBoost;
      for (const rec of recs) {
        const t = (rec.type || "").toLowerCase();
        const isQuestionType = t.includes("question") || t.includes("practice") ||
          t.includes("simul") || t.includes("quest");
        if (isQuestionType) {
          rec.priority = cap(rec.priority + PACE_BEHIND_BOOST);
          if (!rec.reason.includes("📈")) {
            rec.reason = `📈 ${rec.reason}`;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[StudyEngine] monthly goal signal skipped:", e);
  }

  // ── Volume rolante 30d + pressão da prova (V3) ────────────────
  // Boost adicional para forçar o aluno a manter ritmo de questões
  // e ajustar a prioridade conforme proximidade da prova.
  try {
    const { getQuestionGoalStatus } = await import("./questionGoalEngine");
    const { getExamPressure } = await import("./examPressureEngine");
    const { STUDY_ENGINE_CALIBRATION } = await import("./studyEngineCalibration");
    const examDateForV3 = (profileData as any)?.exam_date || mentorExamDate;
    const goal = await getQuestionGoalStatus(userId, examDateForV3);
    const exam = getExamPressure(examDateForV3);
    const cal = STUDY_ENGINE_CALIBRATION;

    for (const rec of recs) {
      const t = (rec.type || "").toLowerCase();
      const isQuestionType =
        t === "practice" ||
        t === "simulado" ||
        t === "error_review" ||
        t.includes("question") ||
        t.includes("simul");
      const isNewContent = t === "new" || t === "new_content" || t.includes("new_topic");

      // (a) Volume: backlog rolante 30d
      if (goal.status === "behind" && isQuestionType) {
        rec.priority = cap(rec.priority + cal.questionGoalBehindBoost);
        if (!rec.reason.includes("📊")) rec.reason = `📊 ${rec.reason}`;
      }
      if (goal.backlog > cal.thresholds.heavyBacklog && isQuestionType) {
        rec.priority = cap(rec.priority + cal.monthlyGoalHeavyBacklogBoost);
      }

      // (b) Pressão da prova → multiplica prioridade
      if (exam.multiplier !== 1.0) {
        rec.priority = cap(rec.priority * exam.multiplier);
      }

      // (c) Conteúdo novo perto da prova → reduz
      if (
        exam.days !== null &&
        exam.days >= 0 &&
        exam.days < cal.thresholds.finalStretchDays &&
        isNewContent
      ) {
        rec.priority = cap(rec.priority - cal.examPressure.newContentPenaltyUnder30Days);
        if (!rec.reason.includes("⏱️")) rec.reason = `⏱️ ${rec.reason}`;
      }
    }
  } catch (e) {
    console.warn("[StudyEngine] question goal / exam pressure skipped:", e);
  }

  // ── Distribuição estratégica de questões (V3.1) ────────────────
  // Aplica boosts por categoria conforme a fase do aluno (longo prazo,
  // médio prazo, reta final) e ajustes adaptativos (cobertura, erros,
  // atraso na meta). Tudo defensivo — sem quebrar o motor.
  try {
    const { getQuestionDistribution } = await import("./questionDistributionEngine");
    const { getCoverageStatus } = await import("./coverageEngine");
    const { getQuestionGoalStatus } = await import("./questionGoalEngine");

    const examDateForDist = (profileData as any)?.exam_date || mentorExamDate;
    const daysUntilExamDist = examDateForDist
      ? Math.max(0, Math.ceil((new Date(examDateForDist).getTime() - Date.now()) / 86400000))
      : null;

    const [covStatus, goalStatus] = await Promise.all([
      getCoverageStatus(userId).catch(() => null),
      getQuestionGoalStatus(userId, examDateForDist).catch(() => null),
    ]);

    const errorCountForDist = errors?.length ?? 0;

    const distRes = getQuestionDistribution({
      daysUntilExam: daysUntilExamDist,
      coveragePct: covStatus?.requiredCoveragePct,
      errorCount: errorCountForDist,
      isBehindGoal: goalStatus?.status === "behind",
    });

    const d = distRes.distribution;
    const { STUDY_ENGINE_CALIBRATION: calDist } = await import("./studyEngineCalibration");
    const divisor = calDist.questionDistribution.boostScaleDivisor || 4;
    // Boosts proporcionais ao peso de cada categoria
    const boostFromPct = (pct: number) => Math.round(pct / divisor);

    for (const rec of recs) {
      const t = (rec.type || "").toLowerCase();
      const isError = t.includes("error") || t.includes("erro") || t === "error_review";
      const isRevision = t.includes("review") || t.includes("revis") || t === "fsrs" || t === "flashcard";
      const isCoverage = t === "new" || t === "new_content" || t.includes("new_topic") || t.includes("coverage");
      const isIncidence = t === "practice" || t === "simulado" || t.includes("question") || t.includes("simul");

      if (isError) rec.priority = cap(rec.priority + boostFromPct(d.error));
      else if (isRevision) rec.priority = cap(rec.priority + boostFromPct(d.revision));
      else if (isCoverage) rec.priority = cap(rec.priority + boostFromPct(d.coverage));
      else if (isIncidence) rec.priority = cap(rec.priority + boostFromPct(d.incidence));

      // Compressão extra na reta final (<30d) já é tratada no bloco V3,
      // aqui só destacamos com selo visual.
      if (distRes.phase === "final_stretch" && (isRevision || isError)) {
        if (!rec.reason.includes("🎯")) {
          // não duplica o selo já usado pelo coverage gap (também 🎯)
          // mantemos sem prefixo adicional para evitar ruído
        }
      }
    }
  } catch (e) {
    console.warn("[StudyEngine] question distribution skipped:", e);
  }

  // ── Approval Risk Signal (V3.2) ───────────────────────────────
  // Lê o approvalEngine como fonte oficial e aplica boosts/penalidades
  // por risco de reprovação, tendência de queda e folga (low risk).
  // Defensivo — se o cálculo falhar, motor segue normal sem bloquear.
  let approvalSignal: {
    score: number;
    trend: "up" | "down" | "stable";
    riskLevel: "low" | "medium" | "high";
  } | null = null;
  try {
    const { calculateApprovalScore } = await import("./approvalEngine");
    const { STUDY_ENGINE_CALIBRATION: calApp } = await import("./studyEngineCalibration");
    const { getCoverageStatus } = await import("./coverageEngine");

    // ── Coleta defensiva dos sinais (fallback seguro)
    const recent100 = practiceAttempts.slice(0, 100);
    const accuracy = recent100.length > 0
      ? (recent100.filter((a: any) => a.correct).length / recent100.length) * 100
      : 0;

    let coveragePctApp = 0;
    try {
      const cov = await getCoverageStatus(userId);
      coveragePctApp = cov?.requiredCoveragePct ?? 0;
    } catch {}

    const since7ms = Date.now() - 7 * 86400000;
    const uniqueDays = new Set(
      practiceAttempts
        .filter((a: any) => new Date(a.created_at).getTime() >= since7ms)
        .map((a: any) => String(a.created_at).slice(0, 10))
    );
    const consistency = (uniqueDays.size / 7) * 100;

    const totalRev = pendingReviews.length;
    const fsrsHealthApp = totalRev > 0
      ? Math.max(0, 100 - (overdueCount / totalRev) * 100)
      : 100;

    const since30ms = Date.now() - 30 * 86400000;
    const questions30dApp = practiceAttempts.filter(
      (a: any) => new Date(a.created_at).getTime() >= since30ms
    ).length;
    const questions7dApp = practiceAttempts.filter(
      (a: any) => new Date(a.created_at).getTime() >= since7ms
    ).length;

    const examDateForApp = (profileData as any)?.exam_date || mentorExamDate;
    const daysToExamApp = examDateForApp
      ? Math.ceil((new Date(examDateForApp).getTime() - Date.now()) / 86400000)
      : null;

    // ── Busca previousScore para trend (último snapshot)
    let previousScore: number | null = null;
    try {
      const { data: prevSnap } = await supabase
        .from("approval_scores")
        .select("score")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevSnap && typeof prevSnap.score === "number") previousScore = prevSnap.score;
    } catch {}

    const result = calculateApprovalScore({
      accuracy,
      coverage: coveragePctApp,
      consistency,
      fsrsHealth: fsrsHealthApp,
      questionsVolume: questions30dApp,
      questions7d: questions7dApp,
      fsrsDue: overdueCount,
      daysToExam: daysToExamApp,
      previousScore,
    });

    approvalSignal = {
      score: result.score,
      trend: result.trend,
      riskLevel: result.riskLevel,
    };

    // ── Aplica boosts/penalidades nas recs
    const ar = calApp.approvalRisk;
    for (const rec of recs) {
      const t = (rec.type || "").toLowerCase();
      const isQuestion = t === "practice" || t === "simulado" || t.includes("question") || t.includes("simul");
      const isReview = t === "review" || t.includes("review") || t.includes("revis") || t === "fsrs" || t === "flashcard";
      const isError = t === "error_review" || t.includes("error") || t.includes("erro");
      const isNewContent = t === "new" || t === "new_content" || t.includes("new_topic");
      const isCoverage = isNewContent || t.includes("coverage");

      let touched: "high" | "down" | "low" | null = null;

      if (result.riskLevel === "high") {
        if (isQuestion) { rec.priority = cap(rec.priority + ar.highRiskQuestionBoost); touched = "high"; }
        if (isReview)   { rec.priority = cap(rec.priority + ar.highRiskReviewBoost); touched = "high"; }
        if (isError)    { rec.priority = cap(rec.priority + ar.highRiskReviewBoost); touched = "high"; }
        if (isNewContent) { rec.priority = cap(rec.priority - ar.highRiskNewContentPenalty); touched = "high"; }
      }
      if (result.trend === "down") {
        if (isReview) { rec.priority = cap(rec.priority + ar.downTrendReviewBoost); touched = touched ?? "down"; }
        if (isError)  { rec.priority = cap(rec.priority + ar.downTrendErrorBoost); touched = touched ?? "down"; }
      }
      if (result.riskLevel === "low") {
        if (isCoverage) { rec.priority = cap(rec.priority + ar.lowRiskCoverageBoost); touched = touched ?? "low"; }
      }

      // Selo visual (não duplica)
      if (touched === "high" && !rec.reason.includes("🚨")) rec.reason = `🚨 ${rec.reason}`;
      else if (touched === "down" && !rec.reason.includes("📉")) rec.reason = `📉 ${rec.reason}`;
      else if (touched === "low" && !rec.reason.includes("🟢")) rec.reason = `🟢 ${rec.reason}`;
    }
  } catch (e) {
    console.warn("[StudyEngine] approval risk signal skipped:", e);
  }

  // ── Mentor topic priority boost (dynamic by exam proximity) ────
  if (mentorTopics.length > 0) {
    // Dynamic boost: flat +10, +15 if ≤30 days, +20 if ≤14 days, +25 if ≤7 days
    const proximityBoost = mentorDaysUntilExam !== null
      ? mentorDaysUntilExam <= 7 ? 25
        : mentorDaysUntilExam <= 14 ? 20
        : mentorDaysUntilExam <= 30 ? 15
        : 10
      : 10;

    const boostedTopics = new Set<string>();
    for (const rec of recs) {
      const isMentorTopic = mentorTopics.some(mt =>
        rec.topic.toLowerCase().includes(mt.toLowerCase()) ||
        rec.specialty.toLowerCase().includes(mt.toLowerCase())
      );
      if (isMentorTopic) {
        rec.priority = cap(rec.priority + proximityBoost);
        if (!rec.reason.includes("📋")) {
          rec.reason = `📋 ${rec.reason}`;
        }
        boostedTopics.add(rec.topic.toLowerCase());
      }
    }

    // Proactive: create new recs for mentor topics not already covered
    const uncoveredTopics = mentorTopics.filter(mt =>
      !boostedTopics.has(mt.toLowerCase()) &&
      ![...boostedTopics].some(bt => bt.includes(mt.toLowerCase()) || mt.toLowerCase().includes(bt))
    );
    for (let i = 0; i < Math.min(uncoveredTopics.length, 3); i++) {
      const mt = uncoveredTopics[i];
      const urgencyLabel = mentorDaysUntilExam !== null && mentorDaysUntilExam <= 14
        ? `⚠️ Prova em ${mentorDaysUntilExam} dias!`
        : mentorDaysUntilExam !== null
        ? `Prova em ${mentorDaysUntilExam} dias.`
        : "";
      addRec({
        id: id("mentor", i),
        type: "new",
        topic: mt,
        specialty: mt,
        priority: cap(60 + proximityBoost - i * 3),
        reason: `📋 Tema da mentoria: "${mt}". ${urgencyLabel} Estude com o Tutor IA.`,
        targetModule: "tutor-v2",
        targetPath: `/dashboard/tutor-v2?topic=${encodeURIComponent(mt)}&source=engine_mentorship`,
        estimatedMinutes: 25,
        objective: "new_content",
        _groupKey: `mentor:${mt}`,
      });
    }
  }

  // ── Enrich with dailyPlanTaskId (lightweight lookup) ─────────
  try {
    const { data: todayPlan } = await supabase
      .from("daily_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_date", today)
      .limit(1)
      .maybeSingle();

    if (todayPlan) {
      const { data: planTasks } = await supabase
        .from("daily_plan_tasks")
        .select("id, title, topic, completed")
        .eq("daily_plan_id", todayPlan.id)
        .eq("completed", false);

      if (planTasks && planTasks.length > 0) {
        for (const rec of recs) {
          const topicLower = (rec.topic || "").toLowerCase();
          const match = planTasks.find(pt => {
            const ptTitle = (pt.title || "").toLowerCase();
            const ptTopic = (pt.topic || "").toLowerCase();
            return ptTitle.includes(topicLower) || ptTopic.includes(topicLower) ||
              topicLower.includes(ptTitle.slice(0, 10)) || topicLower.includes(ptTopic.slice(0, 10));
          });
          if (match) {
            rec.dailyPlanTaskId = match.id;
          }
        }
      }
    }
  } catch {
    // dailyPlanTaskId enrichment is best-effort
  }

  // ── Response time priority boost ──────────────────────────────
  for (const rec of recs) {
    const timeEntry = responseTimeByTopic.get(rec.topic);
    if (timeEntry && timeEntry.count >= 2) {
      const avgTime = timeEntry.total / timeEntry.count;
      if (avgTime > 180) {
        rec.priority = cap(rec.priority + 10);
        if (!rec.reason.includes("⏱")) {
          rec.reason = `⏱ ${rec.reason}`;
        }
      } else if (avgTime > 150) {
        rec.priority = cap(rec.priority + 5);
      }
    }
  }

  // ── Sort by priority then apply weight-based slot limits ─────
  recs.sort((a, b) => b.priority - a.priority);

  // Debug: log canonical IDs before applyWeights
  const recsWithIds = recs.filter(r => (r as any).sourceRecordId || (r as any).errorBankId);
  if (recsWithIds.length > 0) {
    console.log("[StudyEngine] Recs with canonical IDs BEFORE applyWeights:", recsWithIds.length,
      recsWithIds.slice(0, 3).map(r => ({ id: r.id, type: r.type, sourceRecordId: (r as any).sourceRecordId, errorBankId: (r as any).errorBankId }))
    );
  } else {
    console.warn("[StudyEngine] NO recs have canonical IDs before applyWeights");
  }

  const maxTotal = heavyRecovery.active ? heavyRecovery.maxTasks : recoveryMode ? 5 : 8;
  const result = applyWeights(recs, weights, maxTotal);

  // Debug: log canonical IDs after applyWeights
  const resultWithIds = result.filter(r => (r as any).sourceRecordId || (r as any).errorBankId);
  console.log("[StudyEngine] Recs with canonical IDs AFTER applyWeights:", resultWithIds.length, "of", result.length);

  // ── FALLBACK: guarantee at least 1 task for any user ─────────
  if (result.length === 0) {
    return {
      recommendations: [{
        id: "fallback-start",
        type: "new",
        topic: "Clínica Médica",
        specialty: "Clínica Médica",
        priority: 90,
        reason: "Vamos começar! Estude com o Tutor IA.",
        targetModule: "tutor",
        targetPath: "/dashboard/mentor",
        estimatedMinutes: 20,
      }],
      adaptive,
    };
  }

  // ── Save snapshot (fire-and-forget) ──
  const weakErrors = (errorBankData || []).slice(0, 5).map((e: any) => e.tema);
  const strongDomains = (cd?.domainMap || []).filter((d: any) => d.domain_score >= 70).map((d: any) => d.specialty);
  saveStudyEngineSnapshot({
    userId,
    approvalScore: adaptive.approvalScore,
    phase: adaptive.weights.phase,
    memoryPressure: adaptive.memoryPressure,
    pendingReviews: pendingReviews.length,
    overdueReviews: adaptive.overdueCount,
    contentLock: adaptive.lockStatus !== "allowed",
    recoveryMode: adaptive.recoveryMode,
    heavyRecoveryActive: adaptive.heavyRecovery.active,
    heavyRecoveryPhase: adaptive.heavyRecovery.phase,
    weakTopics: weakErrors,
    strongTopics: strongDomains,
  });

  // Debug: final output verification
  if (result.length > 0) {
    const first = result[0] as any;
    console.log("[StudyEngine] FINAL OUTPUT first rec:", JSON.stringify({
      id: first.id, type: first.type, topic: first.topic,
      sourceRecordId: first.sourceRecordId ?? "UNDEFINED",
      errorBankId: first.errorBankId ?? "UNDEFINED",
      fsrsCardId: first.fsrsCardId ?? "UNDEFINED",
      sourceTable: first.sourceTable ?? "UNDEFINED",
      pendingCount: first.pendingCount ?? "UNDEFINED",
      keys: Object.keys(first),
    }));
  }

  // ── Telemetria fire-and-forget do snapshot do motor (V3) ──────
  try {
    const { logStudyEngineDecision } = await import("./studyEngineTelemetry");
    const examDateForLog = (profileData as any)?.exam_date || mentorExamDate;
    const daysToExamLog = examDateForLog
      ? Math.max(0, Math.ceil((new Date(examDateForLog).getTime() - Date.now()) / 86400000))
      : null;
    let coveragePctLog: number | null = null;
    let monthlyQ30Log: number | null = null;
    let backlogLog: number | null = null;
    let dailyTargetLog: number | null = null;
    let paceLog: "ok" | "behind" | null = null;
    let multiplierLog: number | null = null;
    try {
      const { getCoverageStatus } = await import("./coverageEngine");
      const cov = await getCoverageStatus(userId);
      coveragePctLog = cov?.requiredCoveragePct ?? null;
    } catch {}
    try {
      const { getQuestionGoalStatus } = await import("./questionGoalEngine");
      const g = await getQuestionGoalStatus(userId, examDateForLog);
      monthlyQ30Log = g.questions_30d;
      backlogLog = g.backlog;
      dailyTargetLog = g.daily_target;
      paceLog = g.status;
    } catch {}
    try {
      const { getExamPressure } = await import("./examPressureEngine");
      multiplierLog = getExamPressure(examDateForLog).multiplier;
    } catch {}
    void logStudyEngineDecision({
      userId,
      examDate: examDateForLog,
      daysToExam: daysToExamLog,
      coveragePct: coveragePctLog,
      monthlyQuestions30d: monthlyQ30Log,
      monthlyBacklog: backlogLog,
      dailyQuestionTarget: dailyTargetLog,
      paceStatus: paceLog,
      examMultiplier: multiplierLog,
      approval: approvalSignal
        ? { score: approvalSignal.score, trend: approvalSignal.trend, risk: approvalSignal.riskLevel }
        : null,
      recommendations: result.slice(0, 5).map((r: any) => ({
        topic: r.topic,
        type: r.type,
        priority: r.priority,
        reason: r.reason,
      })),
    });
  } catch (e) {
    console.warn("[StudyEngine] telemetry skipped:", e);
  }

  return { recommendations: result, adaptive };
 } catch (err) {
  console.error("[StudyEngine] Error generating recommendations:", err);
  return {
    recommendations: [{
      id: "fallback-error",
      type: "new",
      topic: "Clínica Médica",
      specialty: "Clínica Médica",
      priority: 90,
      reason: "Vamos começar! Estude com o Tutor IA.",
      targetModule: "tutor",
      targetPath: "/dashboard/mentor",
      estimatedMinutes: 20,
    }],
    adaptive: {
      approvalScore: 0,
      weights: adjustPlanByApprovalScore(0),
      mode: getAdaptiveMode("critico"),
      lockStatus: "allowed",
      lockReasons: [],
      focusReason: "Vamos começar seus estudos!",
      memoryPressure: 0,
      overdueCount: 0,
      recoveryMode: false,
      recoveryReason: "",
      heavyRecovery: buildHeavyRecoveryState(null, false),
    },
  };
 }
}
