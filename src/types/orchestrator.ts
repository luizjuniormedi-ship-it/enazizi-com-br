/**
 * Orchestrator — Shared types between edge function and frontend.
 * F1 (shadow mode): Lightweight types reused by useOrchestrator hook.
 */

export type OrchestratorAction =
  | "study_session"
  | "review_fsrs"
  | "error_review"
  | "tutor"
  | "mnemonic"
  | "image_quiz"
  | "simulado"
  | "clinical_case"
  | "planner_rebuild"
  | "reinforcement";

export type ExecutionMode = "inline" | "navigate" | "drawer";

export interface OrchestratorPayload {
  topic?: string;
  subtopic?: string;
  specialty?: string;
  errorId?: string;
  resultId?: string;
  mnemonicMode?: "review_existing" | "regenerate" | "create_new";
  mnemonicStyle?: string;
  tutorPhase?: string;
  difficulty?: string;
  imageType?: string;
  // Allow extension without breaking shadow mode
  [key: string]: string | number | boolean | undefined;
}

export interface RuleTrace {
  ruleId: string;          // R1..R8
  ruleName: string;
  fired: boolean;
  weight: number;          // contribution if fired
  signals: Record<string, number | string | boolean | null>;
  notes?: string;
}

export interface AdaptiveState {
  pendingReviews: number;
  fsrsDueCount: number;
  repeatedErrorTopics: number;       // distinct topics errado >= 2x
  topErrorCategory: string | null;   // "conceitual" | "memorizacao" | null
  visualWeaknessCount: number;       // image_types com acurácia < 60%
  mnemonicLowUtility: number;        // resultados com utility < 60
  dailyPlanEmpty: boolean;
  lastSimuladoDaysAgo: number | null;
  approvalScore: number | null;
  approvalZone: string;              // "critical" | "recovery" | "stable" | "advanced"
  examProximityDays: number | null;
  weakestTopic: string | null;
  recommendedModality: OrchestratorAction;
}

export interface OrchestratorRecommendation {
  nextAction: OrchestratorAction;
  targetModule: string;              // route hint, e.g. "/dashboard/quiz"
  executionMode: ExecutionMode;
  priority: number;                  // 0-100
  reason: string;
  cta: string;
  payload: OrchestratorPayload;
  confidence: number;                // 0-1
}

export interface OrchestratorResponse {
  success: boolean;
  recommendation: OrchestratorRecommendation;
  alternatives: OrchestratorRecommendation[];
  adaptiveState: AdaptiveState;
  rulesTrace: RuleTrace[];
  /** Snapshot id for tying outcomes back later (F6). */
  decisionId?: string;
  /** Flag: when true, frontend may consume; when false, shadow only. */
  shadowMode: boolean;
  generatedAt: string;
}
