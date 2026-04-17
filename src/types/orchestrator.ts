/**
 * Orchestrator V2 — Shared types between edge function and frontend.
 * F1 (shadow mode) → F3 (UI consumption) → V2 (memory, cooldown, profile, exploration).
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

export type StudyPhase = "base" | "consolidacao" | "reta_final" | "unknown";

export type FatigueLevel = "low" | "medium" | "high";

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

/** V2 — explicit per-rule numeric breakdown for full auditability. */
export interface RuleTrace {
  ruleId: string;
  ruleName: string;
  fired: boolean;
  /** legacy aggregate; equals finalScore for backward compat */
  weight: number;
  baseWeight?: number;
  tunedWeight?: number;
  cooldownPenalty?: number;
  repetitionPenalty?: number;
  effectivenessBoost?: number;
  phaseBoost?: number;
  fatiguePenalty?: number;
  explorationAdjustment?: number;
  finalScore?: number;
  signals: Record<string, number | string | boolean | null>;
  notes?: string;
}

export interface ActionMemory {
  /** last 5 recommendations (most recent first) */
  recent: { action: OrchestratorAction; topic: string | null; at: string }[];
  /** ISO timestamp of last action per modality */
  lastByModality: Partial<Record<OrchestratorAction, string>>;
  /** last action per topic */
  lastByTopic: Record<string, { action: OrchestratorAction; at: string }>;
  /** count of identical action in the recent window */
  repeatedCount: number;
}

export interface EffectivenessProfile {
  /** improvement delta average (-1..+1) per modality, computed from outcomes */
  byModality: Partial<Record<OrchestratorAction, number>>;
  bestModality: OrchestratorAction | null;
  worstModality: OrchestratorAction | null;
  sampleSize: number;
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
  /** V2 fields */
  studyPhase: StudyPhase;
  fatigue: FatigueLevel;
  fatigueScore: number;
  actionsCompletedToday: number;
  memory: ActionMemory;
  effectiveness: EffectivenessProfile;
  exploration: boolean;
}

export type RecommendationBadge =
  | "exploring"
  | "repetition_avoided"
  | "tutor_favored"
  | "high_review_urgency"
  | "fatigue_aware"
  | "phase_aligned";

export interface OrchestratorRecommendation {
  nextAction: OrchestratorAction;
  targetModule: string;
  executionMode: ExecutionMode;
  priority: number;
  reason: string;
  cta: string;
  payload: OrchestratorPayload;
  confidence: number;
  badges?: RecommendationBadge[];
  humanReason?: string;
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
