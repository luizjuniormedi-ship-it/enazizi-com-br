import { ReadinessLabel } from "./examReadiness";

/**
 * Implementation of Readiness Score V2
 * Formula: 40% domínio + 25% incidência dominada + 20% retenção FSRS + 15% desempenho simulados
 */
export interface ReadinessV2Input {
  masteryScore: number;          // 0-100 (Average correct rate)
  incidenceMastery: number;      // 0-100 (Mastery of high incidence themes)
  fsrsRetention: number;         // 0-100 (Average recall probability)
  simuladoPerformance: number;   // 0-100 (Average score in simulations)
}

export function calculateReadinessScoreV2(input: ReadinessV2Input): number {
  const score = 
    (input.masteryScore * 0.40) + 
    (input.incidenceMastery * 0.25) + 
    (input.fsrsRetention * 0.20) + 
    (input.simuladoPerformance * 0.15);
    
  return Math.round(Math.min(Math.max(score, 0), 100));
}

export function getReadinessV2Label(score: number): ReadinessLabel {
  if (score <= 40) return "critico";
  if (score <= 60) return "risco_alto";
  if (score <= 75) return "competitivo";
  if (score <= 90) return "forte";
  return "elite";
}
