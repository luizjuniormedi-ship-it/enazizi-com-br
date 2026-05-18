/**
 * ENAZIZI — PREMIUM PRIORITIZATION ENGINE (Frontend)
 * 
 * Objective: Unified mathematical prioritization formula.
 * Formula: PRIORIDADE = (TaxaErro × 3) + (ProbabilidadeDeCair × 3) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) - (Domínio × 2)
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
  const C_ERROR = 3;
  const C_INCIDENCE = 3;
  const C_FSRS = 2;
  const C_PROXIMITY = 2;
  const C_MASTERY = 2;

  const rawScore = 
    (metrics.errorRate * C_ERROR) +
    (metrics.fallProbability * C_INCIDENCE) +
    (metrics.fsrsRisk * C_FSRS) +
    (metrics.examProximity * C_PROXIMITY) -
    (metrics.currentMastery * C_MASTERY);

  // Normalization: Max 10, Min -2.
  const normalized = ((rawScore + 2) / 12) * 100;
  
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
