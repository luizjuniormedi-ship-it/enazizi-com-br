/**
 * Coverage Priority Boost (Fase 1.4)
 * ──────────────────────────────────
 * Helper puro, isolado, sem dependências de React/Supabase.
 * Recebe sinais de cobertura de um subtopic e devolve um boost
 * normalizado a ser somado à prioridade do Study Engine.
 *
 * Regras explícitas, calibradas e auditáveis. Toda decisão é
 * registrada em `boostBreakdown` para observabilidade no admin.
 *
 * IMPORTANTE: este módulo NUNCA lança erro. Em qualquer dado
 * faltante/ inválido devolve boost = 0 silenciosamente. Quem
 * consome decide como integrar (com flag, normalização, etc.).
 */

import type { CoverageStatus, ImportanceLevel } from "./coverageRules";

export type CoverageBoostLevel = "none" | "low" | "medium" | "high" | "critical";

export interface CoverageBoostInput {
  status: CoverageStatus | null | undefined;
  importanceLevel: ImportanceLevel;
  questionsCount: number;
  strongQuestionsCount: number;
  materialsCount: number;
  flashcardsCount: number;
  microtopicsCount: number;
  bancaCoverageCount: number;
}

export interface CoverageBoostBreakdown {
  statusBoost: number;
  importanceBoost: number;
  incidenceBoost: number;
  pedagogyGapBoost: number;
  questionGapBoost: number;
}

export interface CoverageBoostResult {
  boostScore: number;            // 0-100 (cru, antes de normalização externa)
  boostLevel: CoverageBoostLevel;
  boostReason: string;
  boostBreakdown: CoverageBoostBreakdown;
}

const ZERO_BREAKDOWN: CoverageBoostBreakdown = {
  statusBoost: 0,
  importanceBoost: 0,
  incidenceBoost: 0,
  pedagogyGapBoost: 0,
  questionGapBoost: 0,
};

export const ZERO_BOOST: CoverageBoostResult = {
  boostScore: 0,
  boostLevel: "none",
  boostReason: "",
  boostBreakdown: ZERO_BREAKDOWN,
};

/** Multiplicador padrão usado pelo Study Engine: bruto × 0.15 → bonus aplicado. */
export const COVERAGE_BOOST_APPLY_MULTIPLIER = 0.15;

/** Mapeia score 0-100 para nível semântico. */
export function classifyBoostLevel(score: number): CoverageBoostLevel {
  if (!Number.isFinite(score) || score <= 0) return "none";
  if (score < 20) return "low";
  if (score < 40) return "medium";
  if (score < 70) return "high";
  return "critical";
}

function statusContribution(status: CoverageStatus | null | undefined): number {
  switch (status) {
    case "missing": return 40;
    case "critical": return 30;
    case "partial": return 10;
    case "complete": return 0;
    default: return 0;
  }
}

function importanceContribution(level: ImportanceLevel): number {
  switch (level) {
    case "muito_cobrado": return 25;
    case "cobrado": return 15;
    case "pouco_cobrado": return 5;
    case "raro": return 0;
    default: return 0;
  }
}

function incidenceContribution(bancaCount: number): number {
  if (!Number.isFinite(bancaCount) || bancaCount <= 0) return 0;
  if (bancaCount >= 4) return 20;
  if (bancaCount >= 2) return 10;
  return 5; // exatamente 1
}

function pedagogyGapContribution(materials: number, flashcards: number): number {
  let v = 0;
  if (materials <= 0) v += 10;
  if (flashcards <= 0) v += 10;
  if (materials <= 0 && flashcards <= 0) v += 10; // bônus extra
  return v;
}

function questionGapContribution(qCount: number, qStrong: number): number {
  let v = 0;
  if (qCount <= 0) v += 20;
  else if (qCount < 2) v += 10;
  if (qStrong <= 0) v += 5;
  return v;
}

function safeNum(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/** Helper puro principal — sempre retorna um boost válido (nunca lança). */
export function computeCoverageBoost(input: CoverageBoostInput | null | undefined): CoverageBoostResult {
  if (!input) return ZERO_BOOST;
  try {
    const qCount = safeNum(input.questionsCount);
    const qStrong = safeNum(input.strongQuestionsCount);
    const materials = safeNum(input.materialsCount);
    const flashcards = safeNum(input.flashcardsCount);
    const banca = safeNum(input.bancaCoverageCount);

    const breakdown: CoverageBoostBreakdown = {
      statusBoost: statusContribution(input.status),
      importanceBoost: importanceContribution(input.importanceLevel),
      incidenceBoost: incidenceContribution(banca),
      pedagogyGapBoost: pedagogyGapContribution(materials, flashcards),
      questionGapBoost: questionGapContribution(qCount, qStrong),
    };

    const raw =
      breakdown.statusBoost +
      breakdown.importanceBoost +
      breakdown.incidenceBoost +
      breakdown.pedagogyGapBoost +
      breakdown.questionGapBoost;

    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const level = classifyBoostLevel(score);
    const reason = buildReason(breakdown, input, score);

    return {
      boostScore: score,
      boostLevel: level,
      boostReason: reason,
      boostBreakdown: breakdown,
    };
  } catch {
    return ZERO_BOOST;
  }
}

function buildReason(b: CoverageBoostBreakdown, input: CoverageBoostInput, score: number): string {
  if (score <= 0) return "";
  // Pega o maior contribuidor como motivo principal
  const parts: Array<{ label: string; value: number }> = [
    { label: input.status ? `status ${input.status}` : "", value: b.statusBoost },
    { label: input.importanceLevel ?? "", value: b.importanceBoost },
    { label: `${input.bancaCoverageCount ?? 0} banca(s)`, value: b.incidenceBoost },
    { label: "lacuna pedagógica", value: b.pedagogyGapBoost },
    { label: "lacuna de questões", value: b.questionGapBoost },
  ].filter((p) => p.value > 0 && p.label);
  parts.sort((a, b2) => b2.value - a.value);
  if (parts.length === 0) return "";
  const top = parts.slice(0, 2).map((p) => p.label).join(" + ");
  return `Boost por ${top}.`;
}

/** Aplica multiplicador padrão e arredonda — pronto para somar à prioridade. */
export function appliedBoostFromScore(score: number, multiplier: number = COVERAGE_BOOST_APPLY_MULTIPLIER): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.round(score * multiplier);
}

/** Cor semântica → variante de badge. */
export function boostBadgeVariant(level: CoverageBoostLevel): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "critical": return "destructive";
    case "high": return "destructive";
    case "medium": return "default";
    case "low": return "secondary";
    case "none":
    default: return "outline";
  }
}

export function boostLevelLabel(level: CoverageBoostLevel): string {
  return { none: "Sem boost", low: "Baixo", medium: "Médio", high: "Alto", critical: "Crítico" }[level];
}
