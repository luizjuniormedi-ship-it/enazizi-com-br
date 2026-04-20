import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RadarTelemetryData {
  windowDays: number;
  counts: {
    trajectory_apply: number;
    planner_apply: number;
    planner_reject: number;
    trajectory_complete: number;
  };
  rejectReasons: Record<string, number>;
  acceptanceByType: Record<string, { apply: number; reject: number; total: number; rate: number }>;
  overallAcceptance: number;
  totalPlannerCalls: number;
  lastAction: {
    id: string;
    status: string;
    appliedAt: string;
    completedAt: string | null;
    decisionId: string | null;
    recommendation: {
      title?: string;
      rationale?: string;
      orchestrator_action?: string;
      target_module?: string;
      priority?: number;
    } | null;
    payload: Record<string, unknown>;
    outcome: Record<string, unknown> | null;
  } | null;
}

export function useRadarTelemetry() {
  return useQuery<RadarTelemetryData>({
    queryKey: ["radar-telemetry"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("trajectory-telemetry-v1", {
        method: "POST",
      });
      if (error) throw error;
      return data as RadarTelemetryData;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
