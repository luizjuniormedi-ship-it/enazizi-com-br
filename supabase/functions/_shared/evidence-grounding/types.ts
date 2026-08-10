export type EvidenceSourceType = 
  | 'literature' 
  | 'guideline' 
  | 'official_exam' 
  | 'gold_question' 
  | 'validated_corpus'
  | 'validated_question';

export interface EvidenceItem {
  evidenceId: string;
  sourceType: EvidenceSourceType;
  title?: string;
  excerpt: string;
  topic: string;
  canonicalTopic: string;
  sourceId: string;
  version?: string;
  publicationYear?: number;
  authorityTier?: number; // Higher number = higher authority
  relevanceScore: number; // 0-1
}

export interface EvidenceConflict {
  sourceA: string;
  sourceB: string;
  topic: string;
  nature: string;
}

export interface GoldQuestionReference {
  id: string;
  correct_answer: string;
  topic: string;
  tier: 'GOLD' | 'SILVER';
}

export interface OfficialExamReference {
  id: string;
  institution: string;
  year: number;
  topic: string;
}

export interface EvidenceContextPack {
  requestId: string;
  canonicalTopic: string;
  specialty: string;
  aliases: string[];
  evidence: EvidenceItem[];
  goldQuestions: GoldQuestionReference[];
  officialExamReferences: OfficialExamReference[];
  conflicts: EvidenceConflict[];
  retrievalConfidence: number;
  generatedAt: string;
  contextHash: string; // Hash of the evidence content to ensure cross-provider parity
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
  critical_hallucination: boolean;
  evidence_status: 'robust' | 'sufficient' | 'insufficient_evidence' | 'conflicting_evidence';
}

export interface GroundedOutput<T = any> {
  data: T;
  grounding: GroundingScore;
  claims: ClinicalClaim[];
  source_ids: string[];
  answer_key_support?: boolean;
}
