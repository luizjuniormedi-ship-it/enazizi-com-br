/**
 * Memory Consolidation Engine — Sprint 1 (ENAZIZI)
 * Tipos compartilhados entre UI, hook e edge function.
 */

export type ConsolidationSource = 'tutor_v3' | 'error_review' | 'fsrs_due' | 'manual';
export type ConsolidationStep = 'retrieval' | 'connective_summary' | 'metacog' | 'confidence';
export type ConsolidationStatus = 'in_progress' | 'completed' | 'abandoned';

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
}

export interface MemoryConsolidationResponse {
  id: string;
  session_id: string;
  step: ConsolidationStep;
  prompt: string | null;
  response: string | null;
  ai_evaluation: Record<string, unknown>;
  score: number | null;
  latency_ms: number | null;
  created_at: string;
}

/** Eventos novos emitidos pelo Memory Consolidation Engine (Event Bus). */
export const MEMORY_CONSOLIDATION_EVENTS = {
  STARTED: 'memory_consolidation_started',
  COMPLETED: 'memory_consolidation_completed',
  FALSE_CONFIDENCE: 'false_confidence_detected',
  KNOWLEDGE_GAP: 'knowledge_gap_detected',
  REVIEW_PRIORITY_INCREASED: 'review_priority_increased',
} as const;

export type MemoryConsolidationEvent =
  (typeof MEMORY_CONSOLIDATION_EVENTS)[keyof typeof MEMORY_CONSOLIDATION_EVENTS];

export interface StartConsolidationInput {
  topic_id?: string | null;
  topic_label: string;
  subtopic_id?: string | null;
  source: ConsolidationSource;
  trigger_event_id?: string | null;
  context_summary?: string;
}

export interface RespondStepInput {
  session_id: string;
  step: ConsolidationStep;
  response: string;
  /** Para o passo 'confidence': valor 0-100 do slider antes do gabarito. */
  confidence_value?: number;
}

export interface CompleteSessionResult {
  session_id: string;
  mastery_score: number;
  confidence_score: number;
  false_confidence_flag: boolean;
  metacog_quality: number;
  summary: string;
  emitted_events: MemoryConsolidationEvent[];
}
