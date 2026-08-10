export type EvidenceSourceType = 
  | 'literature' 
  | 'guideline' 
  | 'official_exam' 
  | 'gold_question' 
  | 'validated_corpus'
  | 'validated_question'
  | 'pubmed_abstract'
  | 'pubmed_central_fulltext';

export type StudyType = 
  | 'guideline'
  | 'systematic_review'
  | 'meta_analysis'
  | 'randomized_trial'
  | 'cohort'
  | 'case_control'
  | 'cross_sectional'
  | 'case_series'
  | 'case_report'
  | 'review'
  | 'other';

export interface EvidenceItem {
  evidenceId: string;
  sourceType: EvidenceSourceType;
  PMID?: string;
  PMCID?: string;
  DOI?: string;
  title: string;
  abstract?: string;
  excerpt: string;
  publicationYear?: number;
  journal?: string;
  studyType?: StudyType;
  topic: string;
  canonicalTopic: string;
  specialty?: string;
  sourceId: string;
  authorityTier: number; // 1-10, higher = higher authority
  relevanceScore: number; // 0-1
  evidenceLevel?: number; // Oxford Level of Evidence (1-5)
  fullTextAvailable: boolean;
  retrievedAt: string;
}

export interface EvidenceConflict {
  sourceIds: string[];
  claim: string;
  conflictType: 'contradiction' | 'dosage_divergence' | 'indication_conflict';
  authorityDifference: number;
}

export interface GoldQuestionReference {
  id: string;
  correctAnswer: string;
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
  contextPackId: string;
  contextHash: string;
  canonicalTopic: string;
  aliases: string[];
  evidence: EvidenceItem[];
  goldQuestions: GoldQuestionReference[];
  officialExamRefs: OfficialExamReference[];
  conflicts: EvidenceConflict[];
  retrievalConfidence: number;
  freshness: string;
  createdAt: string;
}

export interface ClinicalClaim {
  claim: string;
  status: 'supported' | 'unsupported' | 'conflicting';
  evidenceIds: string[];
  reasoning?: string;
}

export interface GroundingScore {
  overall_score: number; // 0-100
  grounding_score: number; // supported / total claims (0-1)
  unsupported_claim_rate: number; // (0-1)
  topic_match_score: number;
  critical_hallucination: boolean;
  evidence_status: 'robust' | 'sufficient' | 'insufficient_evidence' | 'conflicting_evidence';
}

export interface GroundedOutput<T = any> {
  data: T;
  grounding: GroundingScore;
  claims: ClinicalClaim[];
  sourceIds: string[];
  answerKeySupported?: boolean;
}
