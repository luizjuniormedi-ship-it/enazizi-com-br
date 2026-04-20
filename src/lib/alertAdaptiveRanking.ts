/**
 * alertAdaptiveRanking — Fase 5 do Alert Orchestrator
 * ─────────────────────────────────────────────────────
 * Computa um ajuste defensivo de prioridade (-2..+2) por `source` com
 * base em métricas históricas (impressions, ctr, fatigue, resolução).
 *
 * Princípios:
 *   - Não altera nada sem amostra mínima (impressions < 5)
 *   - Decisões puras (sem efeitos colaterais)
 *   - 100% auditável: sempre devolve um `reason`
 *   - Usado em conjunto com `alertSafetyFloors` para impedir que alertas
 *     críticos (exam-date, approval-risk) sejam rebaixados demais.
 */
import type { AlertSource } from "@/types/alertOrchestrator";

export interface AdaptiveAdjustment {
  priorityDelta: number; // -2 .. +2
  reason: string;
}

/** Shape mínima necessária — compatível com FatigueMeasure e AlertSourceMetrics. */
export interface AdaptiveInput {
  source: string;
  impressions?: number;
  exposed?: number;
  clicks?: number;
  clicked?: number;
  dismissals?: number;
  dismissed?: number;
  resolved?: number;
  ctr: number;
  fatigueScore: number;
  resolutionRate?: number;
}

function pick(...vals: Array<number | undefined>): number {
  for (const v of vals) {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  }
  return 0;
}

export function computeAdaptiveAdjustment(m: AdaptiveInput): AdaptiveAdjustment {
  const impressions = pick(m.impressions, m.exposed);
  const clicks = pick(m.clicks, m.clicked);
  const dismissals = pick(m.dismissals, m.dismissed);
  const ctr = m.ctr;
  const fatigueScore = m.fatigueScore;
  const resolutionRate = pick(m.resolutionRate);

  // Sem dados suficientes → não altera
  if (impressions < 5) {
    return { priorityDelta: 0, reason: "low-sample" };
  }

  // 🔴 ALTO DESGASTE → reduzir prioridade
  if (fatigueScore >= 70) {
    return { priorityDelta: -2, reason: "high-fatigue" };
  }

  // 🟠 FADIGA MODERADA
  if (fatigueScore >= 40) {
    return { priorityDelta: -1, reason: "medium-fatigue" };
  }

  // 🟢 ALTA PERFORMANCE → aumentar prioridade
  if (ctr >= 0.2 && resolutionRate >= 0.3) {
    return { priorityDelta: +2, reason: "high-performance" };
  }

  // 🟢 BOA RESOLUÇÃO
  if (resolutionRate >= 0.4) {
    return { priorityDelta: +1, reason: "high-resolution" };
  }

  // 🔻 IGNORADO
  if (impressions >= 10 && clicks === 0 && dismissals >= 0) {
    return { priorityDelta: -1, reason: "ignored" };
  }

  return { priorityDelta: 0, reason: "neutral" };
}

/**
 * Pisos de segurança por source: garante que alertas vitais nunca sejam
 * rebaixados ao ponto de sumir. Aplicado APÓS `computeAdaptiveAdjustment`.
 *
 * Regra: retorna o delta efetivo, possivelmente clampado.
 */
export function applySafetyFloor(
  source: AlertSource,
  delta: number
): { delta: number; clamped: boolean; reason?: string } {
  // exam-date nunca é rebaixado por adaptive
  if (source === "exam-date" && delta < 0) {
    return { delta: 0, clamped: true, reason: "floor:exam-date" };
  }
  // approval-risk só pode descer 1 nível no máximo
  if (source === "approval-risk" && delta < -1) {
    return { delta: -1, clamped: true, reason: "floor:approval-risk" };
  }
  // recovery e fsrs-backlog protegidos contra rebaixamento severo
  if (source === "recovery" && delta < -1) {
    return { delta: -1, clamped: true, reason: "floor:recovery" };
  }
  if (source === "fsrs-backlog" && delta < -1) {
    return { delta: -1, clamped: true, reason: "floor:fsrs-backlog" };
  }
  return { delta, clamped: false };
}

/**
 * Constrói um mapa source → { delta, reason } pronto para o orchestrator
 * aplicar. Já aplica `applySafetyFloor`.
 */
export function buildAdjustmentMap(
  measures: ReadonlyArray<AdaptiveInput>
): Map<string, { delta: number; reason: string; clamped: boolean }> {
  const map = new Map<string, { delta: number; reason: string; clamped: boolean }>();
  for (const m of measures) {
    const adj = computeAdaptiveAdjustment(m);
    const floored = applySafetyFloor(m.source as AlertSource, adj.priorityDelta);
    map.set(m.source, {
      delta: floored.delta,
      reason: floored.clamped ? `${adj.reason}+${floored.reason}` : adj.reason,
      clamped: floored.clamped,
    });
  }
  return map;
}
