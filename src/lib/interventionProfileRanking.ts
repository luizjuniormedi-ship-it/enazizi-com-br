/**
 * interventionProfileRanking — Ajuste por perfil individual (Fase 6)
 * ───────────────────────────────────────────────────────────────────
 * Helpers puros que decidem o `weightDelta` aplicado por candidata
 * com base no histórico individual do usuário (`intervention_user_profiles`).
 *
 * Não consulta banco: recebe input já agregado.
 * Clamp final: [-10, +10].
 */

export interface InterventionProfileAdjustmentInput {
  type: string;
  shownCount: number;
  clickedCount: number;
  resolvedCount: number;
  ctr: number;
  conversionRate: number;
  profileScore: number;
}

export interface InterventionProfileAdjustment {
  /** Delta a somar no finalWeight (clamp -10..+10). */
  weightDelta: number;
  /** Razão textual para telemetria/debug. */
  reason:
    | "low-sample"
    | "very-good-fit"
    | "good-fit"
    | "weak-fit"
    | "poor-fit"
    | "neutral";
}

const MIN_SAMPLE = 5;

export function computeProfileAdjustment(
  input: InterventionProfileAdjustmentInput
): InterventionProfileAdjustment {
  const { shownCount, clickedCount, profileScore } = input;

  // 1) Amostra insuficiente — não interfere
  if (shownCount < MIN_SAMPLE) {
    return { weightDelta: 0, reason: "low-sample" };
  }

  // 2) Rejeição forte por perfil (15+ exposições, 0 cliques)
  if (shownCount >= 15 && clickedCount === 0) {
    return { weightDelta: clamp(-10), reason: "poor-fit" };
  }

  // 3) Fit ruim (10+ exposições, score muito baixo)
  if (shownCount >= 10 && profileScore < 0.08) {
    return { weightDelta: clamp(-6), reason: "weak-fit" };
  }

  // 4) Fit muito bom
  if (profileScore >= 0.3) {
    return { weightDelta: clamp(10), reason: "very-good-fit" };
  }

  // 5) Fit bom
  if (profileScore >= 0.2) {
    return { weightDelta: clamp(6), reason: "good-fit" };
  }

  return { weightDelta: 0, reason: "neutral" };
}

function clamp(n: number): number {
  return Math.max(-10, Math.min(10, n));
}
