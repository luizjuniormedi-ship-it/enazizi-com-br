/**
 * useRadarTrajetoria — busca a última snapshot + cenários + riscos +
 * oportunidades + recomendações do usuário a partir das tabelas trajectory_*.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  TrajectorySnapshot,
  TrajectoryScenario,
  TrajectoryRisk,
  TrajectoryOpportunity,
  TrajectoryRecommendation,
  TrajectoryAppliedAction,
  DataCompleteness,
  ScenarioType,
  Horizon,
  Severity,
  EffortLevel,
  AppliedActionStatus,
} from "@/types/trajectory";
import type { OrchestratorAction } from "@/types/orchestrator";

export interface RadarBundle {
  snapshot: TrajectorySnapshot | null;
  scenarios: TrajectoryScenario[];
  risks: TrajectoryRisk[];
  opportunities: TrajectoryOpportunity[];
  recommendations: TrajectoryRecommendation[];
  appliedActions: TrajectoryAppliedAction[];
}

function mapSnapshot(row: any): TrajectorySnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    runId: row.run_id ?? null,
    createdAt: row.created_at,
    questionsLast7d: row.questions_last_7d ?? 0,
    questionsLast28d: row.questions_last_28d ?? 0,
    activeDaysLast14d: row.active_days_last_14d ?? 0,
    fsrsDueCount: row.fsrs_due_count ?? 0,
    fsrsOverdueCount: row.fsrs_overdue_count ?? 0,
    errorBankOpenCount: row.error_bank_open_count ?? 0,
    simuladoCountLast28d: row.simulado_count_last_28d ?? 0,
    accuracyLast28d: row.accuracy_last_28d ?? null,
    retentionProxy: row.retention_proxy ?? null,
    examProximityDays: row.exam_proximity_days ?? null,
    consistencyScore: Number(row.consistency_score ?? 0),
    retentionScore: Number(row.retention_score ?? 0),
    executionScore: Number(row.execution_score ?? 0),
    backlogScore: Number(row.backlog_score ?? 0),
    overallScore: Number(row.overall_score ?? 0),
    confidenceScore: Number(row.confidence_score ?? 0),
    dataCompleteness: (row.data_completeness ?? "insufficient") as DataCompleteness,
    rawSignals: (row.raw_signals ?? {}) as Record<string, unknown>,
  };
}

function mapScenario(row: any): TrajectoryScenario {
  return {
    id: row.id,
    userId: row.user_id,
    snapshotId: row.snapshot_id,
    scenarioType: row.scenario_type as ScenarioType,
    horizonDays: row.horizon_days as Horizon,
    projectedConsistency: Number(row.projected_consistency ?? 0),
    projectedRetention: Number(row.projected_retention ?? 0),
    projectedExecution: Number(row.projected_execution ?? 0),
    projectedBacklog: Number(row.projected_backlog ?? 0),
    projectedOverall: Number(row.projected_overall ?? 0),
    deltaOverall: Number(row.delta_overall ?? 0),
    costIntensity: Number(row.cost_intensity ?? 0),
    retentionRisk: Number(row.retention_risk ?? 0),
    confidenceScore: Number(row.confidence_score ?? 0),
    assumptions: (row.assumptions ?? {}) as Record<string, unknown>,
    rationale: row.rationale ?? null,
    createdAt: row.created_at,
  };
}

function mapRisk(row: any): TrajectoryRisk {
  return {
    id: row.id,
    userId: row.user_id,
    snapshotId: row.snapshot_id,
    riskKey: row.risk_key,
    title: row.title,
    description: row.description ?? null,
    severity: row.severity as Severity,
    impactScore: Number(row.impact_score ?? 0),
    evidence: (row.evidence ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function mapOpportunity(row: any): TrajectoryOpportunity {
  return {
    id: row.id,
    userId: row.user_id,
    snapshotId: row.snapshot_id,
    opportunityKey: row.opportunity_key,
    title: row.title,
    description: row.description ?? null,
    potentialGain: Number(row.potential_gain ?? 0),
    effortLevel: row.effort_level as EffortLevel,
    evidence: (row.evidence ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function mapRecommendation(row: any): TrajectoryRecommendation {
  return {
    id: row.id,
    userId: row.user_id,
    snapshotId: row.snapshot_id,
    recommendationKey: row.recommendation_key,
    title: row.title,
    description: row.description ?? null,
    orchestratorAction: row.orchestrator_action as OrchestratorAction,
    targetModule: row.target_module ?? "/dashboard",
    payload: (row.payload ?? {}) as Record<string, unknown>,
    expectedImpact: Number(row.expected_impact ?? 0),
    effortLevel: row.effort_level as EffortLevel,
    priority: Number(row.priority ?? 3),
    rationale: row.rationale ?? null,
    badges: Array.isArray(row.badges) ? (row.badges as string[]) : [],
    createdAt: row.created_at,
  };
}

function mapAppliedAction(row: any): TrajectoryAppliedAction {
  return {
    id: row.id,
    userId: row.user_id,
    snapshotId: row.snapshot_id ?? null,
    recommendationId: row.recommendation_id ?? null,
    decisionId: row.decision_id ?? null,
    orchestratorAction: (row.orchestrator_action ?? null) as OrchestratorAction | null,
    targetModule: row.target_module ?? null,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: (row.status ?? "pending_orchestrator") as AppliedActionStatus,
    appliedAt: row.applied_at ?? row.created_at,
    completedAt: row.completed_at ?? null,
    outcome: (row.outcome ?? null) as Record<string, unknown> | null,
    createdAt: row.created_at,
  };
}

export function useRadarTrajetoria() {
  const { user } = useAuth();

  return useQuery<RadarBundle>({
    queryKey: ["radar-trajetoria", user?.id],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<RadarBundle> => {
      const { data: snapRow, error: snapErr } = await supabase
        .from("trajectory_snapshots")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (snapErr) throw snapErr;

      if (!snapRow) {
        return {
          snapshot: null,
          scenarios: [],
          risks: [],
          opportunities: [],
          recommendations: [],
          appliedActions: [],
        };
      }

      const snapshot = mapSnapshot(snapRow);
      const snapId = snapshot.id;

      const [sc, rk, op, rc, aa] = await Promise.all([
        supabase
          .from("trajectory_scenarios")
          .select("*")
          .eq("snapshot_id", snapId),
        supabase
          .from("trajectory_risk_factors")
          .select("*")
          .eq("snapshot_id", snapId)
          .order("impact_score", { ascending: false }),
        supabase
          .from("trajectory_opportunities")
          .select("*")
          .eq("snapshot_id", snapId)
          .order("potential_gain", { ascending: false }),
        supabase
          .from("trajectory_recommendations")
          .select("*")
          .eq("snapshot_id", snapId)
          .order("priority", { ascending: true }),
        supabase
          .from("trajectory_applied_actions")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      return {
        snapshot,
        scenarios: (sc.data ?? []).map(mapScenario),
        risks: (rk.data ?? []).map(mapRisk),
        opportunities: (op.data ?? []).map(mapOpportunity),
        recommendations: (rc.data ?? []).map(mapRecommendation),
        appliedActions: (aa.data ?? []).map(mapAppliedAction),
      };
    },
  });
}
