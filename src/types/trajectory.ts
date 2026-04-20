/**
 * Radar de Trajetória IA — Tipos compartilhados (frontend ↔ edge functions)
 *
 * Espelhados em supabase/functions/trajectory-engine-v1.
 * v1: motor 100% determinístico + 1 LLM (apenas no trajectory-explain-v1).
 */

import type { OrchestratorAction } from "./orchestrator";

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot
// ─────────────────────────────────────────────────────────────────────────────
export type DataCompleteness = "complete" | "partial" | "insufficient";

export interface TrajectoryScores {
  consistencyScore: number;
  retentionScore: number;
  executionScore: number;
  backlogScore: number;
  overallScore: number;
  confidenceScore: number;
}

export interface TrajectorySnapshot extends TrajectoryScores {
  id: string;
  userId: string;
  runId: string | null;
  createdAt: string;

  // Volume
  questionsLast7d: number;
  questionsLast28d: number;
  activeDaysLast14d: number;
  fsrsDueCount: number;
  fsrsOverdueCount: number;
  errorBankOpenCount: number;
  simuladoCountLast28d: number;

  // Brutas
  accuracyLast28d: number | null;
  retentionProxy: number | null;
  examProximityDays: number | null;

  dataCompleteness: DataCompleteness;
  rawSignals: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cenários
// ─────────────────────────────────────────────────────────────────────────────
export type ScenarioType = "current" | "conservative" | "aggressive" | "recommended";
export type Horizon = 14 | 28 | 56;

export interface TrajectoryScenario {
  id: string;
  userId: string;
  snapshotId: string;
  scenarioType: ScenarioType;
  horizonDays: Horizon;

  projectedConsistency: number;
  projectedRetention: number;
  projectedExecution: number;
  projectedBacklog: number;
  projectedOverall: number;

  deltaOverall: number;
  costIntensity: number; // 0–1
  retentionRisk: number; // 0–1
  confidenceScore: number;

  assumptions: Record<string, unknown>;
  rationale: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Riscos / Oportunidades / Recomendações
// ─────────────────────────────────────────────────────────────────────────────
export type Severity = "low" | "medium" | "high" | "critical";
export type EffortLevel = "low" | "medium" | "high";

export interface TrajectoryRisk {
  id: string;
  userId: string;
  snapshotId: string;
  riskKey: string;
  title: string;
  description: string | null;
  severity: Severity;
  impactScore: number;
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface TrajectoryOpportunity {
  id: string;
  userId: string;
  snapshotId: string;
  opportunityKey: string;
  title: string;
  description: string | null;
  potentialGain: number;
  effortLevel: EffortLevel;
  evidence: Record<string, unknown>;
  createdAt: string;
}

export interface TrajectoryRecommendation {
  id: string;
  userId: string;
  snapshotId: string;
  recommendationKey: string;
  title: string;
  description: string | null;

  orchestratorAction: OrchestratorAction;
  targetModule: string;
  payload: Record<string, unknown>;

  expectedImpact: number;
  effortLevel: EffortLevel;
  priority: number;
  rationale: string | null;
  badges: string[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aplicação / runs
// ─────────────────────────────────────────────────────────────────────────────
export type AppliedActionStatus = "proposed" | "applied" | "cancelled" | "completed";

export interface TrajectoryAppliedAction {
  id: string;
  userId: string;
  snapshotId: string | null;
  recommendationId: string | null;
  decisionId: string | null;
  orchestratorAction: OrchestratorAction | null;
  targetModule: string | null;
  payload: Record<string, unknown>;
  status: AppliedActionStatus;
  appliedAt: string;
  completedAt: string | null;
  outcome: Record<string, unknown> | null;
  createdAt: string;
}

export interface TrajectoryRun {
  id: string;
  userId: string;
  status: "pending" | "running" | "success" | "failed";
  engineVersion: string;
  durationMs: number | null;
  errorMessage: string | null;
  triggerSource: string | null;
  snapshotId: string | null;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Respostas das edge functions
// ─────────────────────────────────────────────────────────────────────────────
export interface TrajectoryEngineResponse {
  success: boolean;
  runId: string;
  snapshot: TrajectorySnapshot;
  scenarios: TrajectoryScenario[];
  risks: TrajectoryRisk[];
  opportunities: TrajectoryOpportunity[];
  recommendations: TrajectoryRecommendation[];
  generatedAt: string;
  error?: string;
}

export interface TrajectoryApplyResponse {
  success: boolean;
  appliedActionId: string;
  decisionId: string | null;
  navigateTo?: string;
  error?: string;
}

export interface TrajectoryExplainResponse {
  success: boolean;
  narrative: string;
  bullets: string[];
  confidence: "alta" | "média" | "baixa";
  generatedAt: string;
  error?: string;
}
