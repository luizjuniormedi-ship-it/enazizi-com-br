/**
 * study-next-scoring.ts
 * Centralised, deterministic scoring helpers for the study-next endpoint.
 * Every magic number lives here so weights are auditable and tunable.
 */

// ─── Weight constants ────────────────────────────────────────────────
export const BASE_SCORES = {
  review: 80,
  fsrs: 82,
  error: 70,
  daily_task: 50,
  image_quiz: 55,
  mnemonic: 52,
  free_study: 10,
} as const;

export const MULTIPLIERS = {
  // approval-score zones
  approvalCritical: 1.35,   // < 50
  approvalWarning: 1.15,    // 50-69
  approvalCompetitive: 1.0, // 70-84
  approvalReady: 0.85,      // ≥ 85

  recoveryMode: 1.25,
  contentLockPenalty: 0.15,  // new-content gets base * this
  missionActiveBoost: 1.12,
  shortSessionPenalty: 0.7,  // for tasks > available time
} as const;

// ─── Visual / mnemonic topic patterns ────────────────────────────────

/** Topics that benefit from image-based training */
export const VISUAL_TOPIC_PATTERNS = [
  /ecg/i, /eletrocardiograma/i, /radiografia/i, /raio.?x/i, /rx\b/i,
  /tomografia/i, /\btc\b/i, /ultrassonografia/i, /\bus\b/i, /ultrassom/i,
  /dermatologia/i, /lesão de pele/i, /lesões cutâneas/i,
  /oftalmologia/i, /fundo de olho/i, /retinografia/i,
  /patologia/i, /lâmina/i, /histopatol/i, /anatomia patol/i,
  /imagem/i, /ressonância/i, /\brm\b/i, /\brnm\b/i,
];

/** Topics that benefit from mnemonic reinforcement */
export const MNEMONIC_TOPIC_PATTERNS = [
  /critérios/i, /classificação/i, /estadiamento/i,
  /farmacologia/i, /fármaco/i, /droga/i, /medicament/i,
  /diagnóstico diferencial/i, /diferencial/i,
  /síndrome/i, /sinais e sintomas/i, /semiologia/i,
  /decoreba/i, /mnemônico/i,
  /fases\b/i, /etapas\b/i, /tipos\b/i,
  /insuficiência/i, /infecção/i, /intoxicação/i,
];

export function isVisualTopic(tema: string, subtema?: string): boolean {
  const text = `${tema} ${subtema ?? ""}`;
  return VISUAL_TOPIC_PATTERNS.some((p) => p.test(text));
}

export function isMnemonicTopic(tema: string, subtema?: string): boolean {
  const text = `${tema} ${subtema ?? ""}`;
  return MNEMONIC_TOPIC_PATTERNS.some((p) => p.test(text));
}

// ─── Approval-zone helper ────────────────────────────────────────────
export type ApprovalZone = "critico" | "atencao" | "competitivo" | "pronto";

export function getApprovalZone(score: number): ApprovalZone {
  if (score < 50) return "critico";
  if (score < 70) return "atencao";
  if (score < 85) return "competitivo";
  return "pronto";
}

function approvalMultiplier(zone: ApprovalZone, isRemedial: boolean): number {
  if (!isRemedial) return 1;
  switch (zone) {
    case "critico": return MULTIPLIERS.approvalCritical;
    case "atencao": return MULTIPLIERS.approvalWarning;
    case "competitivo": return MULTIPLIERS.approvalCompetitive;
    case "pronto": return MULTIPLIERS.approvalReady;
  }
}

// ─── Visual weakness data from attempts ─────────────────────────────
export interface VisualWeaknessEntry {
  imageType: string;
  accuracy: number;       // 0-100
  attemptsCount: number;
  trend: "improving" | "declining" | "stable";
}

// ─── Mnemonic utility data ──────────────────────────────────────────
export interface MnemonicUtilityEntry {
  topic: string;
  avg_utility: number;
  feedback_count: number;
  result_id?: string;
  latest_result_id?: string;
}

// ─── Context type ────────────────────────────────────────────────────
export interface ScoringContext {
  approvalScore: number;
  approvalZone: ApprovalZone;
  recoveryActive: boolean;
  contentLocked: boolean;
  missionActive: boolean;
  sessionMinutes: number | null; // null = unknown
  examProximityDays: number | null;
  now: string; // ISO
  today: string; // YYYY-MM-DD
  /** Count of published image quiz questions available */
  imageQuizAvailable: number;
  /** Real visual weakness data from medical_image_attempts */
  visualWeaknesses?: VisualWeaknessEntry[];
  /** Mnemonic utility data aggregated from feedback */
  mnemonicUtility?: MnemonicUtilityEntry[];
  /** ENAMED Theme weights for Phase 2 prioritization */
  enamedWeights?: Record<string, { incidence: number, impact: number }>;
}

// ─── Mnemonic mode decision ─────────────────────────────────────────
export type MnemonicMode = "review_existing" | "regenerate" | "create_new";
export type MnemonicStyle = "visual" | "curto" | "engraçado" | "acadêmico";

export interface MnemonicDecision {
  mode: MnemonicMode;
  preferredStyle?: MnemonicStyle;
  resultId?: string;
  utilityScore?: number;
}

/**
 * Decides the mnemonic action mode based on utility data.
 */
export function decideMnemonicMode(
  topic: string,
  utility?: MnemonicUtilityEntry[],
  errorCategory?: string,
): MnemonicDecision {
  if (!utility || utility.length === 0) {
    // No mnemonic exists yet for this topic
    return { mode: "create_new" };
  }

  const match = utility.find(u => u.topic.toLowerCase() === topic.toLowerCase());
  if (!match) return { mode: "create_new" };

  const resultId = match.latest_result_id || match.result_id;

  // Negative utility → regenerate with a different style
  if (match.avg_utility < 0) {
    // Pick style based on context
    let style: MnemonicStyle = "visual";
    if (errorCategory === "conceitual" || errorCategory === "memorização") {
      style = "acadêmico";
    } else if (match.feedback_count >= 3) {
      // Already tried many times, try humor
      style = "engraçado";
    }
    return { mode: "regenerate", preferredStyle: style, resultId, utilityScore: match.avg_utility };
  }

  // Neutral (0) with few feedback → give another chance via review
  if (match.avg_utility === 0 && match.feedback_count <= 2) {
    return { mode: "review_existing", resultId, utilityScore: 0 };
  }

  // Low positive → review existing
  if (match.avg_utility > 0) {
    return { mode: "review_existing", resultId, utilityScore: match.avg_utility };
  }

  // Default: review
  return { mode: "review_existing", resultId, utilityScore: match.avg_utility };
}

// ─── Individual scorers ──────────────────────────────────────────────

export function scoreReview(
  rev: {
    prioridade?: number;
    risco_esquecimento?: number;
    data_revisao?: string;
    temas_estudados?: { tema: string };
  },
  ctx: ScoringContext,
): number {
  let s = BASE_SCORES.review;

  // ENAMED Matrix Boost (Phase 2)
  const theme = rev.temas_estudados?.tema?.toLowerCase();
  if (theme && ctx.enamedWeights && ctx.enamedWeights[theme]) {
    const { incidence, impact } = ctx.enamedWeights[theme];
    s += (incidence * 2); // Boost based on incidence
    s += (impact * 0.5); // Small boost based on impact
  }
  s += Math.min(15, ((rev.prioridade ?? 50) / 100) * 15);
  const riskMap: Record<string, number> = { baixo: 0.2, medio: 0.5, alto: 1.0 };
  const riskVal = typeof rev.risco_esquecimento === "number"
    ? rev.risco_esquecimento
    : riskMap[rev.risco_esquecimento ?? ""] ?? 0.2;
  s += Math.min(20, riskVal * 20);
  if (rev.data_revisao && rev.data_revisao < ctx.today) {
    const overdue = Math.floor(
      (new Date(ctx.today).getTime() - new Date(rev.data_revisao).getTime()) / 86_400_000,
    );
    s += Math.min(16, overdue * 2);
  }
  s *= approvalMultiplier(ctx.approvalZone, true);
  if (ctx.recoveryActive) s *= MULTIPLIERS.recoveryMode;
  return Math.min(150, Math.round(s));
}

export function scoreFSRS(
  card: {
    lapses?: number;
    stability?: number;
    difficulty?: number;
    due?: string;
  },
  ctx: ScoringContext,
): number {
  let s = BASE_SCORES.fsrs;
  s += Math.min(15, (card.lapses ?? 0) * 3);
  const stab = card.stability ?? 5;
  if (stab < 1) s += 12;
  else if (stab < 3) s += 6;
  if ((card.difficulty ?? 5) > 7) s += 5;
  if (card.due) {
    const overdueH = Math.max(0, (Date.now() - new Date(card.due).getTime()) / 3_600_000);
    s += Math.min(10, Math.round(overdueH / 6));
  }
  s *= approvalMultiplier(ctx.approvalZone, true);
  if (ctx.recoveryActive) s *= MULTIPLIERS.recoveryMode;
  return Math.min(150, Math.round(s));
}

export function scoreError(
  err: {
    tema: string;
    vezes_errado?: number;
    updated_at?: string;
    categoria_erro?: string;
  },
  ctx: ScoringContext,
): number {
  let s = BASE_SCORES.error;

  // ENAMED Matrix Boost (Phase 2)
  const theme = err.tema?.toLowerCase();
  if (theme && ctx.enamedWeights && ctx.enamedWeights[theme]) {
    const { incidence, impact } = ctx.enamedWeights[theme];
    s += (incidence * 3); // High incidence errors are critical
    s += (impact * 1);    // High impact errors are critical
  }
  s += Math.min(25, (err.vezes_errado ?? 1) * 4);
  if (err.updated_at) {
    const daysSince = (Date.now() - new Date(err.updated_at).getTime()) / 86_400_000;
    if (daysSince <= 3) s += 8;
    else if (daysSince <= 7) s += 4;
  }
  if (err.categoria_erro === "conceitual") s += 6;
  s *= approvalMultiplier(ctx.approvalZone, true);
  if (ctx.recoveryActive) s *= MULTIPLIERS.recoveryMode;
  return Math.min(150, Math.round(s));
}

export function scoreDailyTask(
  task: {
    topic?: string;
    priority?: string;
    estimated_minutes?: number;
    task_type?: string;
  },
  ctx: ScoringContext,
): number {
  let s = BASE_SCORES.daily_task;

  // ENAMED Matrix Boost (Phase 2)
  const theme = task.topic?.toLowerCase();
  if (theme && ctx.enamedWeights && ctx.enamedWeights[theme]) {
    const { incidence, impact } = ctx.enamedWeights[theme];
    s += (incidence * 1.5); 
    s += (impact * 0.5);
  }
  if (task.priority === "high") s += 20;
  else if (task.priority === "medium") s += 10;
  if (ctx.missionActive) s *= MULTIPLIERS.missionActiveBoost;
  if (ctx.sessionMinutes && (task.estimated_minutes ?? 15) > ctx.sessionMinutes) {
    s *= MULTIPLIERS.shortSessionPenalty;
  }
  if (ctx.recoveryActive) s *= 0.8;
  return Math.min(150, Math.round(s));
}

export function scoreFreeStudy(ctx: ScoringContext): number {
  let s = BASE_SCORES.free_study;
  if (ctx.contentLocked) s *= MULTIPLIERS.contentLockPenalty;
  if (ctx.recoveryActive) s *= 0.5;
  return Math.round(s);
}

// ─── Image Quiz scorer ──────────────────────────────────────────────
export function scoreImageQuiz(
  visualErrors: Array<{
    tema: string;
    subtema?: string;
    vezes_errado: number;
    updated_at?: string;
  }>,
  ctx: ScoringContext,
): { score: number; bestTopic: typeof visualErrors[0] | null; targetImageType?: string } {
  if (ctx.imageQuizAvailable === 0) {
    return { score: 0, bestTopic: null };
  }

  let errorScore = 0;
  let bestErrorTopic: typeof visualErrors[0] | null = null;

  if (visualErrors.length > 0) {
    bestErrorTopic = visualErrors.reduce((a, b) =>
      b.vezes_errado > a.vezes_errado ? b : a
    );
    errorScore = BASE_SCORES.image_quiz;
    errorScore += Math.min(20, bestErrorTopic.vezes_errado * 5);
    if (bestErrorTopic.updated_at) {
      const daysSince = (Date.now() - new Date(bestErrorTopic.updated_at).getTime()) / 86_400_000;
      if (daysSince <= 3) errorScore += 10;
      else if (daysSince <= 7) errorScore += 5;
    }
    if (visualErrors.length >= 3) errorScore += 8;
    else if (visualErrors.length >= 2) errorScore += 4;
  }

  let weaknessScore = 0;
  let weakestType: string | undefined;

  if (ctx.visualWeaknesses && ctx.visualWeaknesses.length > 0) {
    const candidates = ctx.visualWeaknesses.filter(w => w.attemptsCount >= 1);
    if (candidates.length > 0) {
      const weakest = candidates.reduce((a, b) => a.accuracy < b.accuracy ? a : b);
      weakestType = weakest.imageType;

      if (weakest.accuracy < 50) {
        weaknessScore = BASE_SCORES.image_quiz + 25;
      } else if (weakest.accuracy < 65) {
        weaknessScore = BASE_SCORES.image_quiz + 15;
      } else if (weakest.accuracy < 75) {
        weaknessScore = BASE_SCORES.image_quiz + 5;
      } else {
        weaknessScore = BASE_SCORES.image_quiz;
      }
      if (weakest.trend === "declining") weaknessScore += 15;
      if (weakest.attemptsCount < 5) weaknessScore = Math.max(weaknessScore - 5, BASE_SCORES.image_quiz);
    }
  }

  let s = Math.max(errorScore, weaknessScore);
  if (s === 0 && visualErrors.length === 0 && (!ctx.visualWeaknesses || ctx.visualWeaknesses.length === 0)) {
    return { score: 0, bestTopic: null };
  }
  if (s === 0) s = BASE_SCORES.image_quiz;

  s *= approvalMultiplier(ctx.approvalZone, true);
  if (ctx.recoveryActive) s *= 1.05;
  if (ctx.examProximityDays !== null && ctx.examProximityDays <= 30) s += 8;
  if (ctx.sessionMinutes && ctx.sessionMinutes < 15) s += 5;

  return {
    score: Math.min(130, Math.round(s)),
    bestTopic: bestErrorTopic,
    targetImageType: weakestType,
  };
}

// ─── Mnemonic scorer (enhanced with utility data) ───────────────────
/**
 * Scores a Mnemonic recommendation based on repeated errors
 * on memorization-heavy topics, enhanced with real utility feedback data.
 */
export function scoreMnemonic(
  mnemonicCandidateErrors: Array<{
    tema: string;
    subtema?: string;
    vezes_errado: number;
    categoria_erro?: string;
    updated_at?: string;
  }>,
  ctx: ScoringContext,
): { score: number; bestTopic: typeof mnemonicCandidateErrors[0] | null } {
  if (mnemonicCandidateErrors.length === 0) {
    // Even without error_bank matches, check if utility data shows useful mnemonics
    if (ctx.mnemonicUtility && ctx.mnemonicUtility.length > 0) {
      // Find a highly useful mnemonic the student hasn't reviewed recently
      const useful = ctx.mnemonicUtility.filter(u => u.avg_utility > 0 && u.feedback_count >= 2);
      if (useful.length > 0) {
        const best = useful.reduce((a, b) => b.avg_utility > a.avg_utility ? b : a);
        // Create a synthetic "topic" for this — moderate score since there's no active error
        const s = Math.min(130, Math.round(BASE_SCORES.mnemonic + best.avg_utility * 5));
        return {
          score: s,
          bestTopic: { tema: best.topic, subtema: undefined, vezes_errado: 0, updated_at: undefined },
        };
      }
    }
    return { score: 0, bestTopic: null };
  }

  let s = BASE_SCORES.mnemonic;

  // Pick most repeated error on a mnemonic-friendly topic
  const best = mnemonicCandidateErrors.reduce((a, b) =>
    b.vezes_errado > a.vezes_errado ? b : a
  );

  const errs = best.vezes_errado;
  if (errs >= 4) s += 25;
  else if (errs >= 3) s += 18;
  else if (errs >= 2) s += 10;
  else return { score: 0, bestTopic: null };

  // Recency
  if (best.updated_at) {
    const daysSince = (Date.now() - new Date(best.updated_at).getTime()) / 86_400_000;
    if (daysSince <= 3) s += 8;
    else if (daysSince <= 7) s += 4;
  }

  // Category bonus
  if (best.categoria_erro === "conceitual") s += 6;
  if (best.categoria_erro === "memorização") s += 10;

  // Multiple mnemonic-worthy topics
  if (mnemonicCandidateErrors.length >= 3) s += 6;

  // ── NEW: Utility data amplification / dampening ──
  if (ctx.mnemonicUtility && ctx.mnemonicUtility.length > 0) {
    const match = ctx.mnemonicUtility.find(
      u => u.topic.toLowerCase() === best.tema.toLowerCase()
    );
    if (match) {
      // Positive utility → boost (mnemonic is proven helpful for this topic)
      if (match.avg_utility > 0) {
        s += Math.min(15, Math.round(match.avg_utility * 5));
      }
      // Negative utility → still recommend but for regeneration (score stays)
      // The mode decision (review vs regenerate) handles this
    }
  }

  // Approval zone: mnemonic is remedial
  s *= approvalMultiplier(ctx.approvalZone, true);
  if (ctx.recoveryActive) s *= 1.1;
  if (ctx.sessionMinutes && ctx.sessionMinutes < 15) s += 5;

  // Exam proximity boost for memorization
  if (ctx.examProximityDays !== null && ctx.examProximityDays <= 30) s += 6;

  return { score: Math.min(130, Math.round(s)), bestTopic: best };
}

// ─── Justification builder ──────────────────────────────────────────

export function buildJustification(
  counts: {
    reviews: number;
    fsrs: number;
    errors: number;
    tasks: number;
    visualErrors?: number;
    mnemonicCandidates?: number;
  },
  ctx: ScoringContext,
  chosenType: string,
): string {
  const parts: string[] = [];

  if (counts.reviews > 0) parts.push(`${counts.reviews} revisão(ões) pendente(s)`);
  if (counts.fsrs > 0) parts.push(`${counts.fsrs} card(s) FSRS vencido(s)`);
  if (counts.errors > 0) parts.push(`${counts.errors} erro(s) recorrente(s)`);

  if (ctx.recoveryActive) parts.push("modo recuperação ativo — carga reduzida");
  if (ctx.contentLocked) parts.push("conteúdo novo bloqueado até limpar pendências");

  if (ctx.approvalZone === "critico")
    parts.push("score de aprovação crítico — foco em revisão e correção");
  else if (ctx.approvalZone === "atencao")
    parts.push("score de aprovação em atenção — estabilizando base");

  if (ctx.examProximityDays !== null && ctx.examProximityDays <= 30)
    parts.push(`prova em ${ctx.examProximityDays} dia(s) — foco intensificado`);

  if (ctx.sessionMinutes && ctx.sessionMinutes < 20)
    parts.push("sessão curta — priorizando ações rápidas");

  if (ctx.missionActive && chosenType === "daily_task")
    parts.push("missão ativa — seguindo plano do dia");

  if (chosenType === "image_quiz") {
    parts.push("dificuldade recorrente em interpretação visual — treino com imagens tem mais impacto agora");
  }

  if (chosenType === "mnemonic") {
    parts.push("erro repetido em conteúdo de memorização — mnemônico pode consolidar melhor a memória");
  }

  if (parts.length === 0) return "Nenhuma pendência crítica. Estudo livre recomendado.";
  return parts.join(". ") + ".";
}

/**
 * Enhanced explainable justification for students.
 */
export function buildExplainableJustification(
  counts: any,
  ctx: ScoringContext,
  chosenType: string,
): string {
  if (chosenType === "mnemonic") {
    return "Detectamos erros repetidos em termos técnicos. Este mnemônico ajudará na consolidação de longo prazo.";
  }
  if (chosenType === "image_quiz") {
    return "Sua precisão em interpretação visual variou recentemente. Praticar com imagens reais aumentará sua segurança clínica.";
  }
  if (ctx.recoveryActive) {
    return "Seu ritmo de estudo está intenso. Sugerimos uma sessão equilibrada para evitar fadiga e manter a retenção.";
  }
  if (ctx.approvalZone === "critico") {
    return "Para estabilizar sua base, o ACE priorizou revisões de temas essenciais que apresentam maior risco de esquecimento.";
  }
  
  return buildJustification(counts, ctx, chosenType);
}

// ─── Diverse alternatives picker ─────────────────────────────────────

export interface ScoredCandidate {
  type: string;
  title: string;
  description: string;
  targetId?: string;
  targetType?: string;
  estimatedMinutes: number;
  priorityScore: number;
  /** Optional context payload for the frontend to use when launching the module */
  contextPayload?: Record<string, unknown>;
}

export function pickDiverseAlternatives(
  all: ScoredCandidate[],
  chosenType: string,
  max = 3,
): ScoredCandidate[] {
  const rest = all.filter((c) => c.type !== chosenType || c.title !== all[0]?.title);

  const buckets = new Map<string, ScoredCandidate[]>();
  for (const c of rest) {
    const b = buckets.get(c.type) ?? [];
    b.push(c);
    buckets.set(c.type, b);
  }

  const result: ScoredCandidate[] = [];
  for (const [, items] of buckets) {
    if (result.length >= max) break;
    result.push(items[0]);
  }
  for (const c of rest) {
    if (result.length >= max) break;
    if (!result.includes(c)) result.push(c);
  }

  return result.slice(0, max);
}
