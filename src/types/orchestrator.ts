/**
 * Orchestrator — Shared types between edge function and frontend.
 * F1 (shadow mode) → F3 (UI consumption with safe fallback).
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
  [key: string]: string | number | boolean | undefined;
}

export interface RuleTrace {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  weight: number;
  signals: Record<string, number | string | boolean | null>;
  notes?: string;
}

export interface AdaptiveState {
  pendingReviews: number;
  fsrsDueCount: number;
  repeatedErrorTopics: number;
  topErrorCategory: string | null;
  visualWeaknessCount: number;
  mnemonicLowUtility: number;
  dailyPlanEmpty: boolean;
  lastSimuladoDaysAgo: number | null;
  approvalScore: number | null;
  approvalZone: string;
  examProximityDays: number | null;
  weakestTopic: string | null;
  recommendedModality: OrchestratorAction;
}

export interface OrchestratorRecommendation {
  nextAction: OrchestratorAction;
  targetModule: string;
  executionMode: ExecutionMode;
  priority: number;
  reason: string;
  cta: string;
  payload: OrchestratorPayload;
  confidence: number;
}

export interface OrchestratorResponse {
  success: boolean;
  recommendation: OrchestratorRecommendation;
  alternatives: OrchestratorRecommendation[];
  adaptiveState: AdaptiveState | null;
  rulesTrace: RuleTrace[];
  decisionId?: string;
  shadowMode: boolean;
  generatedAt: string;
  error?: string;
}
