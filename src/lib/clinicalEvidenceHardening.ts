
export interface EvidenceHardeningStats {
  dqi_inflation_penalty: number;
  transfer_confidence: number;
  case_difficulty_score: number;
  attribution_confidence: number;
  evidence_quality_score: number;
}

export const CASE_DIFFICULTY_MAP: Record<string, number> = {
  "IAM": 0.8,
  "IAM simples": 0.8,
  "Pneumonia": 0.9,
  "CAD": 1.1,
  "Sepse": 1.4,
  "Sepse Grave": 1.4,
  "Choque Séptico": 1.6,
  "Politrauma": 1.8,
  "PCR": 2.0,
};

export const getCaseDifficulty = (diagnosis: string | undefined): number => {
  if (!diagnosis) return 1.0;
  
  // Try exact match or partial match
  for (const [key, value] of Object.entries(CASE_DIFFICULTY_MAP)) {
    if (diagnosis.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return 1.0;
};

export const calculateDQIInflation = (
  examCount: number, 
  maneuverCount: number, 
  redundancyCount: number = 0
): number => {
  let penalty = 0;
  
  // Penalize excessive exams (> 10)
  if (examCount > 10) penalty += (examCount - 10) * 2;
  
  // Penalize excessive maneuvers (> 15)
  if (maneuverCount > 15) penalty += (maneuverCount - 15) * 1;
  
  // Penalize redundancy
  penalty += redundancyCount * 5;
  
  return Math.min(penalty, 40); // Max penalty of 40 points
};

export const calculateTransferConfidence = (
  timeSinceStudyHours: number,
  studyIntensity: number, // 0-1
  repetitionCount: number
): number => {
  // Proximity (max 0.4) - decays after 48h
  const proximity = Math.max(0, 0.4 * (1 - timeSinceStudyHours / 48));
  
  // Intensity (max 0.3)
  const intensity = studyIntensity * 0.3;
  
  // Consistency (max 0.3)
  const consistency = Math.min(repetitionCount / 5, 1) * 0.3;
  
  return proximity + intensity + consistency;
};

export const calculateEvidenceQuality = (components: {
  dqiStability: number;
  transferConfidence: number;
  outcomeCorrelation: number;
  attributionConfidence: number;
  sampleSize: number;
}): number => {
  const { dqiStability, transferConfidence, outcomeCorrelation, attributionConfidence, sampleSize } = components;
  
  // Weighted sum
  const score = (
    dqiStability * 0.2 +
    transferConfidence * 0.25 +
    outcomeCorrelation * 0.2 +
    attributionConfidence * 0.25 +
    Math.min(sampleSize / 10, 1) * 0.1
  ) * 100;
  
  return Math.round(score);
};

export const getEvidenceLabel = (score: number): 'ELITE' | 'STRONG' | 'MODERATE' | 'NEEDS_REVIEW' => {
  if (score >= 90) return 'ELITE';
  if (score >= 80) return 'STRONG';
  if (score >= 70) return 'MODERATE';
  return 'NEEDS_REVIEW';
};
