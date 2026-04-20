/**
 * useInterventionEngine — Next Best Action (V2 adaptativa)
 * ────────────────────────────────────────────────────────
 * V1: regras determinísticas (inatividade → fsrs → recovery → coverage → default).
 * V2: continua usando V1 como base, mas reordena candidatas por
 *     `finalWeight = baseWeight + adaptiveDelta` usando dados de
 *     `useInterventionAnalytics`. Travas mandatórias garantem que cenários
 *     críticos (inatividade, FSRS alto, risco alto) nunca percam para default.
 *
 * Fallback seguro: se a feature flag estiver off OU os analytics ainda não
 * carregaram, devolve a escolha pura da V1.
 */
import { useMemo } from "react";
import { useApprovalPrediction } from "./useApprovalPrediction";
import { useStudyEngineImpact } from "./useStudyEngineImpact";
import { useFsrsDueCount } from "./useFsrsDueCount";
import { useInterventionAnalytics } from "./useInterventionAnalytics";
import { useFeatureFlags } from "./useFeatureFlags";
import { useInterventionPenalty } from "./useInterventionPenalty";
import { useInterventionProfile } from "./useInterventionProfile";
import {
  computeInterventionAdjustment,
  type InterventionAdaptiveAdjustment,
} from "@/lib/interventionAdaptiveRanking";
import {
  computeProfileAdjustment,
  type InterventionProfileAdjustment,
} from "@/lib/interventionProfileRanking";

export type InterventionType =
  | "min-mission"
  | "fsrs"
  | "recovery"
  | "coverage"
  | "default";

export interface InterventionAction {
  type: InterventionType;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  /** Peso base da V1. */
  weight: number;
  /** Peso final após adaptação (V2/V3). Igual a `weight` quando V2/V3 desligadas. */
  finalWeight?: number;
  /** Delta aplicado pela V2 (apenas para telemetria/debug). */
  adaptiveDelta?: number;
  /** Razão textual do ajuste V2 (ex: "high-performance"). */
  adaptiveReason?: string;
  /** Marca cenários mandatórios (não podem ser destronados nem penalizados). */
  mandatory?: boolean;
  /** Nível de penalidade aplicado (Fase 5). 0 = sem penalidade. */
  penaltyLevel?: number;
  /** Delta de penalidade aplicado (Fase 5). 0 quando bypass por mandatory. */
  penaltyDelta?: number;
  /** Indica se a penalidade foi efetivamente aplicada (Fase 5). */
  penaltyApplied?: boolean;
}

export interface InterventionCandidate extends InterventionAction {}

interface InterventionInputs {
  questions7d: number | null;
  totalDue: number | null;
  riskLevel: "high" | "medium" | "low" | null;
  requiredCoveragePct: number | null;
  ready: boolean;
}

/* ─────────────────────────── V1 — gera candidatas ─────────────────────────── */

/**
 * Gera todas as candidatas potencialmente aplicáveis para o estado atual.
 * Mantém a semântica original da V1 (mesmas condições e textos), mas em vez
 * de retornar a primeira que casa, devolve a lista completa para a V2 ranquear.
 *
 * Regra: marca `mandatory: true` nos cenários onde a V1 obrigatoriamente
 * escolhia aquele tipo (inatividade, FSRS alto, risco alto).
 */
export function buildInterventionCandidates(
  i: InterventionInputs
): InterventionCandidate[] {
  if (!i.ready) return [];

  const questions7d = i.questions7d ?? 0;
  const totalDue = i.totalDue ?? 0;
  const requiredCoveragePct = i.requiredCoveragePct ?? 100;

  const candidates: InterventionCandidate[] = [];

  if (questions7d === 0) {
    candidates.push({
      type: "min-mission",
      title: "Missão destrava",
      description: "Vamos destravar com 10 questões + 1 revisão",
      ctaLabel: "Começar agora",
      href: "/banco-questoes?mode=quick10",
      weight: 100,
      mandatory: true,
    });
  }

  if (totalDue > 50) {
    candidates.push({
      type: "fsrs",
      title: "Revisões pendentes",
      description: `Você tem ${totalDue} revisões críticas`,
      ctaLabel: "Revisar agora",
      href: "/flashcards",
      weight: 80,
      mandatory: true,
    });
  }

  if (i.riskLevel === "high") {
    candidates.push({
      type: "recovery",
      title: "Modo recuperação",
      description: "Foque em prática para recuperar desempenho",
      ctaLabel: "Fazer 10 questões",
      href: "/banco-questoes?mode=quick10",
      weight: 70,
      mandatory: true,
    });
  }

  if (requiredCoveragePct < 50) {
    candidates.push({
      type: "coverage",
      title: "Cobertura insuficiente",
      description: "Você precisa avançar nos conteúdos obrigatórios",
      ctaLabel: "Continuar plano",
      href: "/cronograma",
      weight: 50,
    });
  }

  // Default sempre presente como fallback
  candidates.push({
    type: "default",
    title: "Continue evoluindo",
    description: "Vamos manter o ritmo com prática",
    ctaLabel: "Fazer questões",
    href: "/banco-questoes",
    weight: 10,
  });

  return candidates;
}

/* ───────────────── V1 — escolha pura (mantida como fallback) ───────────────── */

export function getNextBestAction(
  i: InterventionInputs
): InterventionAction | null {
  const cands = buildInterventionCandidates(i);
  if (cands.length === 0) return null;
  // V1 = ordem natural (já é prioridade desc por construção)
  return cands[0];
}

/* ───────────────────────────── V2 — adaptativa ────────────────────────────── */

export interface InterventionAdaptiveContext {
  /** Map<actionType, ajuste calculado>. Vazio se analytics indisponível. */
  adjustments: Map<string, InterventionAdaptiveAdjustment>;
  enabled: boolean;
  /** Map<actionType, weightDelta da Fase 5>. Vazio se desligada/sem dados. */
  penalties?: Map<string, { level: number; weightDelta: number }>;
  penaltyEnabled?: boolean;
}

/**
 * Aplica ajuste adaptativo respeitando travas mandatórias:
 *   - Se existe candidata `mandatory`, escolhe a maior `finalWeight` apenas
 *     entre as mandatórias (default nunca pode vencê-las).
 *   - Caso contrário, escolhe a maior `finalWeight` global.
 *   - Penalidade (Fase 5) é aplicada APENAS em candidatas não mandatórias.
 */
export function pickAdaptiveAction(
  candidates: InterventionCandidate[],
  ctx: InterventionAdaptiveContext
): InterventionAction | null {
  if (candidates.length === 0) return null;

  const enriched: InterventionCandidate[] = candidates.map((c) => {
    // V2 — ajuste adaptativo
    const adj = ctx.enabled ? ctx.adjustments.get(c.type) : null;
    const adaptiveDelta = ctx.enabled ? (adj?.weightDelta ?? 0) : 0;
    const adaptiveReason = ctx.enabled
      ? (adj?.reason ?? "no-data")
      : "v2-off";

    // Fase 5 — penalidade (NUNCA aplica em mandatory)
    const penalty =
      ctx.penaltyEnabled && !c.mandatory
        ? ctx.penalties?.get(c.type)
        : undefined;
    const penaltyLevel = penalty?.level ?? 0;
    const penaltyDelta = penalty?.weightDelta ?? 0;
    const penaltyApplied = penaltyDelta !== 0;

    return {
      ...c,
      finalWeight: c.weight + adaptiveDelta + penaltyDelta,
      adaptiveDelta,
      adaptiveReason,
      penaltyLevel,
      penaltyDelta,
      penaltyApplied,
    };
  });

  const mandatory = enriched.filter((c) => c.mandatory);
  const pool = mandatory.length > 0 ? mandatory : enriched;

  // Ordena por finalWeight desc; em empate, mantém ordem original (estável).
  const sorted = [...pool].sort(
    (a, b) => (b.finalWeight ?? b.weight) - (a.finalWeight ?? a.weight)
  );
  return sorted[0] ?? null;
}

/* ──────────────────────────────── Hook React ──────────────────────────────── */

export function useInterventionEngine(): InterventionAction | null {
  const prediction = useApprovalPrediction();
  const { data: impact } = useStudyEngineImpact();
  const { totalDue, isLoading: fsrsLoading } = useFsrsDueCount();
  const { isEnabled } = useFeatureFlags();
  const v2Enabled = isEnabled("intervention_engine_v2_enabled");
  const penaltyEnabled = isEnabled("intervention_penalty_memory_enabled");
  const { data: analytics } = useInterventionAnalytics(7);
  const { penaltiesByType } = useInterventionPenalty();

  return useMemo(() => {
    const ready = !!impact && !fsrsLoading;
    const candidates = buildInterventionCandidates({
      questions7d: impact?.questions7d ?? null,
      totalDue: totalDue ?? null,
      riskLevel: prediction?.riskLevel ?? null,
      requiredCoveragePct: impact?.requiredCoveragePct ?? null,
      ready,
    });

    if (candidates.length === 0) return null;

    // Sem V2 e sem penalidade ativa → fallback puro V1
    const hasPenaltyData = penaltyEnabled && penaltiesByType.size > 0;
    if (!v2Enabled && !hasPenaltyData) {
      return pickAdaptiveAction(candidates, {
        adjustments: new Map(),
        enabled: false,
      });
    }

    const adjustments = new Map<string, InterventionAdaptiveAdjustment>();
    if (v2Enabled && analytics) {
      for (const m of analytics.byType) {
        adjustments.set(
          m.type,
          computeInterventionAdjustment({
            type: m.type,
            exposed: m.exposed,
            clicked: m.clicked,
            resolved: m.resolved,
            ctr: m.ctr,
            conversionRate: m.conversionRate,
          })
        );
      }
    }

    return pickAdaptiveAction(candidates, {
      adjustments,
      enabled: v2Enabled && !!analytics,
      penalties: penaltiesByType,
      penaltyEnabled,
    });
  }, [
    impact,
    totalDue,
    fsrsLoading,
    prediction?.riskLevel,
    v2Enabled,
    analytics,
    penaltyEnabled,
    penaltiesByType,
  ]);
}
