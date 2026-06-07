
export interface PedagogicalCohort {
  id: string;
  user_id: string;
  cohort_type: 'control' | 'experimental';
  joined_at: string;
  is_active: boolean;
}

export interface LearningScienceSnapshot {
  readiness: number;
  forecastAccuracy: number;
  approvalGap: number;
  learningYield: {
    retention: number;
    accuracy: number;
    recovery: number;
    velocity: number;
    score: number;
    formula: string;
    recoveryHalfLife?: number; // D1, D7, etc.
  };
  transferScore: number;
  learningVelocity: {
    last7d: number;
    last30d: number;
    last90d: number;
    currentVelocity: number;
  };
  riskIndex: {
    level: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    factors: {
      readiness: number;
      fsrsBacklog: number;
      errorBankCount: number;
      streakDays: number;
      velocity: number;
    };
  };
  tutorImpact: {
    userTutorReadiness: number;
    nonUserTutorReadiness: number;
    improvementDelta: number;
    recoverySuccessRate: number;
    masteryTimeReduction: number;
  };
  hospitalImpact?: {
    diagnosticErrorReduction: number;
    therapeuticAccuracyGain: number;
    adverseEventPrevention: number;
  };
  fsrsImpact?: {
    retentionGain: number;
    forgettingRateReduction: number;
  };
  pedagogicalCertification?: {
    lesScore: number;
    cohensD: number;
    status: 'certified' | 'pending' | 'failed';
    wave: number;
  };
  featureAttributions: {
    feature: string;
    gainScore: number;
    contributionPercentage: number;
  }[];
  knowledgeDecay: {
    topic: string;
    currentStrength: number;
    predictedStrengthIn9Days: number;
    decayRate: number;
    riskStatus: 'stable' | 'at_risk' | 'critical';
  }[];
  evidenceHealth: {
    score: number;
    label: string;
    sampleSize: number;
    confidenceInterval: number;
    effectSize: number;
    drift: number;
  };
  validation: {
    pearsonCorrelation: number;
    spearmanCorrelation: number;
    rSquared: number;
    forecastAccuracy: number;
    forecastError: number;
    forecastBias: number;
    approvalCalibrationIndex: number;
  };
  causality: {
    confidence: number;
    tier: string;
    stabilityIndex: number;
    effectSize: number;
  };
  institutional?: {
    institutionName: string;
    totalStudents: number;
    avgReadiness: number;
    approvalRate: number;
    evidenceScore: number;
    cohorts: {
      name: string;
      readiness: number;
      velocity: number;
      approvalRate: number;
      retention: number;
      dropoutRisk: number;
    }[];
  };
  validatedAt: string;
  telemetryTags: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
