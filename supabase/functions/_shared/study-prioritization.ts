/**
 * ENAZIZI — PREMIUM PRIORITIZATION ENGINE (v2026)
 * 
 * Objective: Deterministic mathematical prioritization based on real telemetry.
 * Formula: PRIORIDADE = (TaxaErro × 3) + (ProbabilidadeDeCair × 3) + (RiscoFSRS × 2) + (ProximidadeDaProva × 2) - (Domínio × 2)
 */

export interface PrioritizationMetrics {
  errorRate: number;        // 0 to 1 (Taxa de Erro no tema)
  fallProbability: number;  // 0 to 1 (Probabilidade de cair baseada em incidência real)
  fsrsRisk: number;         // 0 to 1 (Risco de esquecimento FSRS: 1 - retrievability)
  examProximity: number;    // 0 to 1 (1 = amanhã, 0 = >90 dias)
  currentMastery: number;   // 0 to 1 (Domínio atual do tema)
}

/**
 * Calculates the priority score (0-100) based on the premium formula.
 */
export function calculatePremiumPriority(metrics: PrioritizationMetrics): number {
  // Coefficients
  const C_ERROR = 3;
  const C_INCIDENCE = 3;
  const C_FSRS = 2;
  const C_PROXIMITY = 2;
  const C_MASTERY = 2;

  // Raw score based on 0-1 metrics
  const rawScore = 
    (metrics.errorRate * C_ERROR) +
    (metrics.fallProbability * C_INCIDENCE) +
    (metrics.fsrsRisk * C_FSRS) +
    (metrics.examProximity * C_PROXIMITY) -
    (metrics.currentMastery * C_MASTERY);

  // Normalization: Max theoretical is 10 (3+3+2+2), Min is -2.
  // We want to map this to 0-100.
  // Base offset to make 0 the midpoint? Or just linear map?
  // Let's use a 0-100 scale where 10 -> 100 and -2 -> 0 is not quite right.
  // The document says "Prioridade deve considerar" and shows the components.
  
  const normalized = ((rawScore + 2) / 12) * 100;
  
  return Math.min(Math.max(Math.round(normalized), 0), 100);
}

/**
 * Maps days until exam to a 0-1 proximity score.
 */
export function calculateExamProximityScore(daysUntilExam: number | null): number {
  if (daysUntilExam === null) return 0.2; // Baseline if unknown
  if (daysUntilExam <= 1) return 1.0;
  if (daysUntilExam >= 90) return 0;
  
  // Linear decay from 1.0 (0 days) to 0 (90 days)
  return 1 - (Math.min(daysUntilExam, 90) / 90);
}

/**
 * Maps FSRS stability to a 0-1 risk score.
 */
export function calculateFsrsRiskScore(retrievability: number | undefined): number {
  if (retrievability === undefined) return 0.5; // Unknown risk
  return Math.max(0, 1 - retrievability);
}
