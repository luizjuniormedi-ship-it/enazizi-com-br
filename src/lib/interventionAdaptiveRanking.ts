/**
 * interventionAdaptiveRanking — Ajuste adaptativo do Intervention Engine V2
 * ─────────────────────────────────────────────────────────────────────────
 * Helper puro (sem React) que, dado o desempenho histórico de um tipo de
 * intervenção (CTR, conversão, fadiga), devolve um `weightDelta` aplicado
 * em cima do peso base da V1.
 *
 * Princípios:
 *   - Nunca substitui a lógica determinística da V1
 *   - Defensivo: amostras pequenas → delta 0 ("low-sample")
 *   - Clamp [-20, +20] para nunca virar a ordem de travas mandatórias
 *   - Reasons rotuladas para auditoria/telemetria
 */
export interface InterventionAdaptiveInput {
  type: string;
  exposed: number;
  clicked: number;
  resolved: number;
  ctr: number;
  conversionRate: number;
  fatigueScore?: number;
}

export interface InterventionAdaptiveAdjustment {
  weightDelta: number; // -20 a +20
  reason: string;
}

export const ADAPTIVE_MIN = -20;
export const ADAPTIVE_MAX = 20;
export const ADAPTIVE_LOW_SAMPLE_THRESHOLD = 5;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(ADAPTIVE_MIN, Math.min(ADAPTIVE_MAX, n));
}

/**
 * Aplica regras simples e seguras. Ordem de avaliação importa pouco
 * porque cada regra é exclusiva (early return), mas seguimos a ordem do
 * brief: amostra → high-perf → conversão → CTR fraco → fadiga → ignorada.
 */
export function computeInterventionAdjustment(
  input: InterventionAdaptiveInput
): InterventionAdaptiveAdjustment {
  const exposed = Math.max(0, input.exposed | 0);
  const clicked = Math.max(0, input.clicked | 0);
  const ctr = Number.isFinite(input.ctr) ? input.ctr : 0;
  const conv = Number.isFinite(input.conversionRate)
    ? input.conversionRate
    : 0;
  const fatigue =
    typeof input.fatigueScore === "number" && Number.isFinite(input.fatigueScore)
      ? input.fatigueScore
      : 0;

  // 1) Amostra insuficiente — nunca promover/rebaixar
  if (exposed < ADAPTIVE_LOW_SAMPLE_THRESHOLD) {
    return { weightDelta: 0, reason: "low-sample" };
  }

  // 2) Alta performance (CTR e conversão fortes)
  if (ctr >= 0.2 && conv >= 0.15) {
    return { weightDelta: clamp(15), reason: "high-performance" };
  }

  // 3) Boa conversão isolada
  if (conv >= 0.25) {
    return { weightDelta: clamp(10), reason: "high-conversion" };
  }

  // 4) CTR fraco com amostra mínima de 10
  if (exposed >= 10 && ctr < 0.05) {
    return { weightDelta: clamp(-10), reason: "low-ctr" };
  }

  // 5) Fadiga alta detectada (vinda do alertFatigue, opcional)
  if (fatigue >= 70) {
    return { weightDelta: clamp(-15), reason: "high-fatigue" };
  }

  // 6) Ignorada demais — exposições suficientes mas zero clique
  if (exposed >= 15 && clicked === 0) {
    return { weightDelta: clamp(-12), reason: "ignored" };
  }

  return { weightDelta: 0, reason: "neutral" };
}
