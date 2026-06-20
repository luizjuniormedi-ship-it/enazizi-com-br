/**
 * ENAZIZI Memory Consolidation Engine — V4.0 (14 etapas)
 * Tipos compartilhados (UI ↔ hook ↔ edge function).
 *
 * O MCE NÃO ensina conteúdo novo. Ele consolida memória, detecta lacunas,
 * mede domínio real e gera evidências reusadas por Tutor V3, Error Bank,
 * FSRS, Planner, Simulados, Cognitive State e Analytics.
 */

export type ConsolidationSource =
  | 'tutor_v3'
  | 'question'
  | 'simulado'
  | 'flashcard'
  | 'error_review'
  | 'mission'
  | 'fsrs_due'
  | 'manual';

export type ConsolidationStep =
  | 'retrieval'
  | 'generation_effect'
  | 'clinical_recall'
  | 'connective_summary'
  | 'metacog'
  | 'confidence';

export type ConsolidationStatus = 'in_progress' | 'completed' | 'abandoned';

export type RigorLevel = 'simplified' | 'standard' | 'full';

export type CognitiveState =
  | 'NOVATO'
  | 'RECONHECIMENTO'
  | 'COMPREENSAO'
  | 'APLICACAO'
  | 'DOMINIO'
  | 'AUTOMATIZACAO';

export type GapSeverity = 'mild' | 'moderate' | 'severe' | 'critical';

export interface KnowledgeGap {
  topic: string;
  subtopic?: string;
  severity: GapSeverity;
}

export interface FsrsCardDraft {
  type: 'concept' | 'diagnosis' | 'conduct' | 'trap' | 'differential';
  front: string;
  back: string;
  priority?: number;
}

export interface PlannerUpdate {
  topic: string;
  delta: number;
  reason: string;
}

export interface ErrorBankEntry {
  topic: string;
  subtopic?: string;
  severity: GapSeverity;
  source: ConsolidationSource;
}

export interface EnamedTakeaways {
  must_memorize: string[];
  exam_pattern: string[];
  trap: string;
  cannot_forget_conduct: string;
}

export interface StartConsolidationInput {
  topic_label: string;
  topic_id?: string | null;
  subtopic_id?: string | null;
  source: ConsolidationSource;
  trigger_event_id?: string | null;
  context_summary?: string;
  /** Pedagogical context (drives rigor + ENAMED weighting). */
  specialty?: string;
  high_yield_score?: number; // 0-100 (ENAMED/ENARE/Revalida incidence)
  enamed_relevance?: number; // 0-100
  student_level?: 'M5' | 'M6' | 'R1' | 'R2' | 'R3' | string;
  cognitive_state?: CognitiveState;
  recent_mistakes?: string[];
  error_bank_context?: string[];
  fsrs_context?: string[];
}

export interface MemoryConsolidationSession {
  id: string;
  user_id: string;
  topic_id: string | null;
  topic_label: string | null;
  subtopic_id: string | null;
  source: ConsolidationSource;
  trigger_event_id: string | null;
  status: ConsolidationStatus;
  mastery_score: number | null;
  confidence_score: number | null;
  false_confidence_flag: boolean;
  metacog_quality: number | null;
  summary_text: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  specialty: string | null;
  high_yield_score: number | null;
  enamed_relevance: number | null;
  cognitive_state: CognitiveState | null;
  advance_allowed: boolean | null;
  micro_reinforcement_required: boolean | null;
  rigor_level: RigorLevel | null;
}

export const MEMORY_CONSOLIDATION_EVENTS = {
  STARTED: 'memory_consolidation_started',
  COMPLETED: 'memory_consolidation_completed',
  FALSE_CONFIDENCE: 'false_confidence_detected',
  KNOWLEDGE_GAP: 'knowledge_gap_detected',
  REVIEW_PRIORITY_INCREASED: 'review_priority_increased',
} as const;

export type MemoryConsolidationEvent =
  (typeof MEMORY_CONSOLIDATION_EVENTS)[keyof typeof MEMORY_CONSOLIDATION_EVENTS];

export interface RespondStepInput {
  session_id: string;
  step: ConsolidationStep;
  response: string;
  confidence_value?: number; // 1-5 Likert OR 0-100
}

export interface CompleteSessionResult {
  memory_consolidation_completed: true;
  session_id: string;
  mastery_score: number;
  confidence_score: number;
  false_confidence: boolean;
  metacog_quality: number;
  cognitive_state: CognitiveState;
  rigor_level: RigorLevel;
  advance_allowed: boolean;
  micro_reinforcement_required: boolean;
  knowledge_gaps: KnowledgeGap[];
  error_bank_entries: ErrorBankEntry[];
  fsrs_cards_to_create: FsrsCardDraft[];
  planner_updates: PlannerUpdate[];
  enamed_takeaways: EnamedTakeaways;
  emitted_events: MemoryConsolidationEvent[];
  summary: string;
}
