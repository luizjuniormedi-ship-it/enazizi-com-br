/**
 * interventionDecisionReason — Fase 7
 * ────────────────────────────────────
 * Helper puro (sem React, sem rede) que classifica QUAL camada do motor
 * decidiu a vitória de uma candidata.
 *
 * Categorias:
 *   - "mandatory": candidata mandatória (trava pedagógica)
 *   - "profile":   maior contribuição positiva veio do profileDelta
 *   - "adaptive":  maior contribuição positiva veio do adaptiveDelta
 *   - "penalty":   penaltyDelta foi relevante e mudou ordem (caso negativo)
 *   - "base":      apenas o peso base sustentou a vitória
 *   - "mixed":     duas ou mais camadas com magnitude semelhante
 *
 * Não consulta banco. Saída usada na telemetria do `InterventionCard`.
 */

export type WinningReason =
  | "mandatory"
  | "base"
  | "adaptive"
  | "penalty"
  | "profile"
  | "mixed";

export interface WinningReasonInput {
  mandatory: boolean;
  adaptiveDelta: number;
  penaltyDelta: number;
  profileDelta: number;
  /** Indica se a penalidade foi efetivamente aplicada (Fase 5). */
  penaltyApplied?: boolean;
}

const RELEVANCE_THRESHOLD = 5; // |delta| < 5 = ruído
const TIE_TOLERANCE = 3;       // |a-b| <= 3 = empate técnico

function n(v: number | null | undefined): number {
  return Number.isFinite(v as number) ? (v as number) : 0;
}

export function getWinningReason(input: WinningReasonInput): WinningReason {
  if (input.mandatory) return "mandatory";

  const a = n(input.adaptiveDelta);
  const p = n(input.penaltyDelta);
  const pr = n(input.profileDelta);

  const aPos = Math.max(0, a);
  const prPos = Math.max(0, pr);
  const penMag = input.penaltyApplied ? Math.abs(p) : 0;

  // Caso 1: nenhuma camada mexeu de forma relevante → base
  if (
    aPos < RELEVANCE_THRESHOLD &&
    prPos < RELEVANCE_THRESHOLD &&
    penMag < RELEVANCE_THRESHOLD
  ) {
    return "base";
  }

  // Encontra o maior contribuinte positivo (promoção)
  const positives: Array<{ key: WinningReason; mag: number }> = [
    { key: "adaptive", mag: aPos },
    { key: "profile", mag: prPos },
  ];
  positives.sort((x, y) => y.mag - x.mag);
  const topPos = positives[0];
  const secondPos = positives[1];

  // Penalty entra como camada decisória apenas se foi aplicada
  // E sua magnitude é >= a maior promoção
  if (
    penMag >= RELEVANCE_THRESHOLD &&
    penMag >= topPos.mag - TIE_TOLERANCE
  ) {
    // Empate entre penalty e uma promoção significativa → mixed
    if (topPos.mag >= RELEVANCE_THRESHOLD && Math.abs(penMag - topPos.mag) <= TIE_TOLERANCE) {
      return "mixed";
    }
    return "penalty";
  }

  // Promoção dominante
  if (topPos.mag >= RELEVANCE_THRESHOLD) {
    // Empate entre adaptive e profile → mixed
    if (
      secondPos.mag >= RELEVANCE_THRESHOLD &&
      Math.abs(topPos.mag - secondPos.mag) <= TIE_TOLERANCE
    ) {
      return "mixed";
    }
    return topPos.key;
  }

  return "base";
}

export const DECISION_VERSION = "intervention-v3.1";
