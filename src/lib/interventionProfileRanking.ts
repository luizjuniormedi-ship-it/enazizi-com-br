/**
 * interventionProfileRanking — Ajuste por perfil individual (Fase 6 — recalibrado)
 * ────────────────────────────────────────────────────────────────────────────────
 * Helpers puros que decidem o `weightDelta` aplicado por candidata
 * com base no histórico individual do usuário (`intervention_user_profiles`).
 *
 * Recalibração (pós-simulação):
 *  - Caps ampliados de ±10 → ±18 para que a preferência individual
 *    consiga superar a dominância estrutural do baseWeight.
 *  - Nova regra `strong-individual-preference` (+20) para sinais
 *    individuais fortes (profileScore alto + CTR alto + amostra OK).
 *  - Mandatory continua intocável (a proteção é feita no engine).
 *
 * Não consulta banco: recebe input já agregado.
 * Clamp final: [-18, +20] (o +20 só vem da regra forte).
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
  /** Delta a somar no finalWeight (clamp -18..+20). */
  weightDelta: number;
  /** Razão textual para telemetria/debug. */
  reason:
    | "low-sample"
    | "strong-individual-preference"
    | "very-good-fit"
    | "good-fit"
    | "weak-fit"
    | "poor-fit"
    | "neutral";
}

const MIN_SAMPLE = 5;
const PROFILE_MIN = -18;
const PROFILE_MAX = 20;

export function computeProfileAdjustment(
  input: InterventionProfileAdjustmentInput
): InterventionProfileAdjustment {
  const { shownCount, clickedCount, ctr, profileScore } = input;

  // 1) Amostra insuficiente — não interfere
  if (shownCount < MIN_SAMPLE) {
    return { weightDelta: 0, reason: "low-sample" };
  }

  // 2) Preferência individual forte — virada legítima
  //    (entra ANTES de very-good-fit conforme spec)
  if (profileScore >= 0.5 && ctr >= 0.4 && shownCount >= 8) {
    return { weightDelta: clamp(20), reason: "strong-individual-preference" };
  }

  // 3) Rejeição forte por perfil (15+ exposições, 0 cliques)
  if (shownCount >= 15 && clickedCount === 0) {
    return { weightDelta: clamp(-18), reason: "poor-fit" };
  }

  // 4) Fit ruim (10+ exposições, score muito baixo)
  if (shownCount >= 10 && profileScore < 0.08) {
    return { weightDelta: clamp(-10), reason: "weak-fit" };
  }

  // 5) Fit muito bom
  if (profileScore >= 0.3) {
    return { weightDelta: clamp(18), reason: "very-good-fit" };
  }

  // 6) Fit bom
  if (profileScore >= 0.2) {
    return { weightDelta: clamp(10), reason: "good-fit" };
  }

  return { weightDelta: 0, reason: "neutral" };
}

function clamp(n: number): number {
  return Math.max(PROFILE_MIN, Math.min(PROFILE_MAX, n));
}
