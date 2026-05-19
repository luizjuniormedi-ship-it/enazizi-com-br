
export type GovernanceLayerStatus = 'optimal' | 'stable' | 'warning' | 'critical';

export interface GovernanceIndices {
  cognitiveLoadScore: number;     // 0-100 (100 = critical overload)
  retentionScore: number;         // 0-100
  recoveryScore: number;          // 0-100 (efficiency of error recovery)
  plannerHealthScore: number;     // 0-100 (alignment with user capacity)
  missionQualityScore: number;    // 0-100 (pedagogical value of daily missions)
  tutorPedagogicalScore: number;  // 0-100 (effectiveness of AI Tutor sessions)
  adaptiveConsistencyScore: number; // 0-100 (how well the system follows the student's evolution)
  approvalConfidenceScore: number; // 0-100 (probability of passing based on current data)
}

export interface GovernanceMetrics {
  indices: GovernanceIndices;
  layers: {
    data: GovernanceLayerStatus;
    cognitiveEngine: GovernanceLayerStatus;
    pedagogicalOrchestration: GovernanceLayerStatus;
    governance: GovernanceLayerStatus;
  };
  lastAudit: string;
}

export interface AIIncident {
  id: string;
  functionName: string;
  modelName: string;
  incidentType: 'hallucination' | 'drift' | 'missing_block' | 'unsafe_response' | 'pedagogical_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  auditedAt: string;
}
