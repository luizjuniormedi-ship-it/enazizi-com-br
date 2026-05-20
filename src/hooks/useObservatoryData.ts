import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PedagogicalEventLineage {
  event_id: string;
  user_id: string;
  event_type: string;
  module: string;
  timestamp: string;
  correlation_id: string;
  request_id: string;
  status: string;
  retry_count: number;
  recursion_depth: number;
  propagation_latency: string;
  consumed_by: any;
  resulting_cognitive_state: string;
}

export function useObservatoryData(limit = 50) {
  return useQuery({
    queryKey: ["alos-observatory-lineage", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedagogical_lineage")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as PedagogicalEventLineage[];
    },
    refetchInterval: 5000, // Real-time feel
  });
}

export function useRuntimeHealth() {
  return useQuery({
    queryKey: ["alos-runtime-health"],
    queryFn: async () => {
      const { data: edgeLogs, error: edgeError } = await supabase
        .from("edge_execution_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: incidents, error: incidentError } = await supabase
        .from("ai_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (edgeError) throw edgeError;
      if (incidentError) throw incidentError;

      // Calculate health metrics
      const avgLatency = edgeLogs.reduce((acc, log) => acc + (log.latency_ms || 0), 0) / (edgeLogs.length || 1);
      const errorRate = (edgeLogs.filter(log => log.status_code >= 400).length / (edgeLogs.length || 1)) * 100;

      return {
        edgeLogs,
        incidents,
        avgLatency,
        errorRate,
        totalCalls: edgeLogs.length
      };
    },
    refetchInterval: 10000,
  });
}