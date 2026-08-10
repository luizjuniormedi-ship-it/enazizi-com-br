export type EvidenceSourceType = 
  | 'medical_literature' 
  | 'official_guideline' 
  | 'official_exam' 
  | 'gold_question' 
  | 'validated_corpus'
  | 'validated_question';

export interface EvidenceSource {
  id: string;
  type: EvidenceSourceType;
  title?: string;
  content: string;
  canonical_topic?: string;
  metadata?: Record<string, any>;
  version?: string;
  timestamp?: string;
  gold_tier?: boolean;
}

export interface EvidenceContextPack {
  request_id: string;
  canonical_topic: string;
  sources: EvidenceSource[];
  hierarchy: EvidenceSourceType[];
  metadata: {
    source_count: number;
    source_type_counts: Record<string, number>;
    topic_match_score: number;
  };
}

export interface ClinicalClaim {
  claim: string;
  status: 'supported' | 'unsupported' | 'conflicting';
  evidence_ids: string[];
  reasoning?: string;
}

export interface GroundingScore {
  overall_score: number; // 0-100
  topic_fidelity: number;
  source_adherence: number;
  unsupported_claims_count: number;
  conflicting_claims_count: number;
  evidence_status: 'robust' | 'sufficient' | 'insufficient_evidence' | 'conflicting_evidence';
}

export interface GroundedOutput<T = any> {
  data: T;
  grounding: GroundingScore;
  claims: ClinicalClaim[];
  source_ids: string[];
  answer_key_support?: boolean;
}
