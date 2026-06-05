/**
 * ENAZIZI — PREMIUM PRIORITIZATION ENGINE (Frontend)
 * 
 * Objective: Unified mathematical prioritization formula for ENAMED 2026.
 * Formula: PRIORIDADE = (IncidênciaENAMED × 3) + (ErroDoAluno × 2) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) + (1 - DomínioAtual × 1)
 */

export interface PrioritizationMetrics {
  errorRate: number;        // 0 to 1
  fallProbability: number;  // 0 to 1
  fsrsRisk: number;         // 0 to 1
  examProximity: number;    // 0 to 1
  currentMastery: number;   // 0 to 1
}

/**
 * Calculates the priority score (0-100) based on the premium formula.
 */
export function calculatePremiumPriority(metrics: PrioritizationMetrics): number {
  const C_INCIDENCE = 3;
  const C_ERROR = 2;
  const C_FSRS = 2;
  const C_PROXIMITY = 2;
  const C_MASTERY = 1;

  const rawScore = 
    (metrics.fallProbability * C_INCIDENCE) +
    (metrics.errorRate * C_ERROR) +
    (metrics.fsrsRisk * C_FSRS) +
    (metrics.examProximity * C_PROXIMITY) +
    ((1 - metrics.currentMastery) * C_MASTERY);

  // Normalization: Max 10 (3+2+2+2+1), Min 0.
  const normalized = (rawScore / 10) * 100;
  
  return Math.min(Math.max(Math.round(normalized), 0), 100);
}

/**
 * Maps days until exam to a 0-1 proximity score.
 */
export function calculateExamProximityScore(daysUntilExam: number | null): number {
  if (daysUntilExam === null) return 0.2;
  if (daysUntilExam <= 1) return 1.0;
  if (daysUntilExam >= 90) return 0;
  return 1 - (Math.min(daysUntilExam, 90) / 90);
}

/**
 * Maps FSRS stability/retrievability to a 0-1 risk score.
 */
export function calculateFsrsRiskScore(retrievability: number | undefined): number {
  if (retrievability === undefined) return 0.5;
  return Math.max(0, 1 - retrievability);
}
