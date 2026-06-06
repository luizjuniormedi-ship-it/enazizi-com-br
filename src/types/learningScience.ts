
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LearningYieldMetrics {
  retention: number;
  accuracy: number;
  recovery: number;
  velocity: number;
  score: number;
  formula: string;
}

export interface LearningVelocity {
  last7d: number;
  last30d: number;
  last90d: number;
  currentVelocity: number; // points per month
}

export interface KnowledgeDecay {
  topic: string;
  currentStrength: number;
  predictedStrengthIn9Days: number;
  decayRate: number;
  riskStatus: 'stable' | 'at_risk' | 'critical';
}

export interface RiskIndex {
  level: RiskLevel;
  score: number; // 0-100
  factors: {
    readiness: number;
    fsrsBacklog: number;
    errorBankCount: number;
    streakDays: number;
    velocity: number;
  };
}

export interface TutorImpact {
  userTutorReadiness: number;
  nonUserTutorReadiness: number;
  improvementDelta: number;
  recoverySuccessRate: number;
  masteryTimeReduction: number; // percentage
}

export interface FeatureAttribution {
  feature: string;
  gainScore: number;
  contributionPercentage: number;
}

export interface LearningScienceSnapshot {
  readiness: number;
  forecastAccuracy: number;
  approvalGap: number;
  learningYield: LearningYieldMetrics;
  transferScore: number;
  learningVelocity: LearningVelocity;
  knowledgeDecay: KnowledgeDecay[];
  riskIndex: RiskIndex;
  tutorImpact: TutorImpact;
  featureAttributions: FeatureAttribution[];
  validatedAt: string;
  telemetryTags: string[];
}
