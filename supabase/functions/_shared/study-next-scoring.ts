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
}

// ─── Individual scorers ──────────────────────────────────────────────

export function scoreReview(
  rev: {
    prioridade?: number;
    risco_esquecimento?: number;
    data_revisao?: string;
  },
  ctx: ScoringContext,
): number {
  let s = BASE_SCORES.review;

  // priority boost (0-100 mapped to 0-15)
  s += Math.min(15, ((rev.prioridade ?? 50) / 100) * 15);

  // forgetting-risk boost (text field: baixo/medio/alto → numeric)
  const riskMap: Record<string, number> = { baixo: 0.2, medio: 0.5, alto: 1.0 };
  const riskVal = typeof rev.risco_esquecimento === "number"
    ? rev.risco_esquecimento
    : riskMap[rev.risco_esquecimento ?? ""] ?? 0.2;
  s += Math.min(20, riskVal * 20);

  // overdue days boost (each day overdue +2, max +16)
  if (rev.data_revisao && rev.data_revisao < ctx.today) {
    const overdue = Math.floor(
      (new Date(ctx.today).getTime() - new Date(rev.data_revisao).getTime()) / 86_400_000,
    );
    s += Math.min(16, overdue * 2);
  }

  // approval zone: reviews are remedial
  s *= approvalMultiplier(ctx.approvalZone, true);

  // recovery boost
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

  // lapses bonus (each +3, max +15)
  s += Math.min(15, (card.lapses ?? 0) * 3);

  // low stability bonus (stability < 1 → up to +12)
  const stab = card.stability ?? 5;
  if (stab < 1) s += 12;
  else if (stab < 3) s += 6;

  // high difficulty bonus
  if ((card.difficulty ?? 5) > 7) s += 5;

  // overdue hours bonus (max +10)
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
    vezes_errado?: number;
    updated_at?: string;
    categoria_erro?: string;
  },
  ctx: ScoringContext,
): number {
  let s = BASE_SCORES.error;

  // frequency bonus (each occurrence +4, max +25)
  s += Math.min(25, (err.vezes_errado ?? 1) * 4);

  // recency bonus — error updated in last 3 days gets +8
  if (err.updated_at) {
    const daysSince = (Date.now() - new Date(err.updated_at).getTime()) / 86_400_000;
    if (daysSince <= 3) s += 8;
    else if (daysSince <= 7) s += 4;
  }

  // conceptual errors are harder to fix → boost
  if (err.categoria_erro === "conceitual") s += 6;

  s *= approvalMultiplier(ctx.approvalZone, true);
  if (ctx.recoveryActive) s *= MULTIPLIERS.recoveryMode;

  return Math.min(150, Math.round(s));
}

export function scoreDailyTask(
  task: {
    priority?: string;
    estimated_minutes?: number;
    task_type?: string;
  },
  ctx: ScoringContext,
): number {
  let s = BASE_SCORES.daily_task;

  // priority
  if (task.priority === "high") s += 20;
  else if (task.priority === "medium") s += 10;

  // mission boost
  if (ctx.missionActive) s *= MULTIPLIERS.missionActiveBoost;

  // session-fit penalty: if task exceeds available time, reduce
  if (ctx.sessionMinutes && (task.estimated_minutes ?? 15) > ctx.sessionMinutes) {
    s *= MULTIPLIERS.shortSessionPenalty;
  }

  // in recovery, daily tasks are secondary to reviews
  if (ctx.recoveryActive) s *= 0.8;

  return Math.min(150, Math.round(s));
}

export function scoreFreeStudy(ctx: ScoringContext): number {
  let s = BASE_SCORES.free_study;
  if (ctx.contentLocked) s *= MULTIPLIERS.contentLockPenalty;
  if (ctx.recoveryActive) s *= 0.5;
  return Math.round(s);
}

// ─── Justification builder ──────────────────────────────────────────

export function buildJustification(
  counts: {
    reviews: number;
    fsrs: number;
    errors: number;
    tasks: number;
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

  if (parts.length === 0) return "Nenhuma pendência crítica. Estudo livre recomendado.";
  return parts.join(". ") + ".";
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
}

export function pickDiverseAlternatives(
  all: ScoredCandidate[],
  chosenType: string,
  max = 3,
): ScoredCandidate[] {
  const rest = all.filter((c) => c.type !== chosenType || c.title !== all[0]?.title);

  // bucket by type
  const buckets = new Map<string, ScoredCandidate[]>();
  for (const c of rest) {
    const b = buckets.get(c.type) ?? [];
    b.push(c);
    buckets.set(c.type, b);
  }

  const result: ScoredCandidate[] = [];
  // one from each type (highest score)
  for (const [, items] of buckets) {
    if (result.length >= max) break;
    result.push(items[0]); // already sorted by score
  }
  // fill remaining from overall sorted
  for (const c of rest) {
    if (result.length >= max) break;
    if (!result.includes(c)) result.push(c);
  }

  return result.slice(0, max);
}
