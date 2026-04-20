/**
 * useRadarSnapshotHistory — últimas N snapshots do usuário (default 5),
 * usado pelo histórico simples na página do Radar.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SnapshotHistoryItem {
  id: string;
  createdAt: string;
  overallScore: number;
  consistencyScore: number;
  retentionScore: number;
  executionScore: number;
  backlogScore: number;
}

export function useRadarSnapshotHistory(limit = 5) {
  const { user } = useAuth();

  return useQuery<SnapshotHistoryItem[]>({
    queryKey: ["radar-snapshot-history", user?.id, limit],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trajectory_snapshots")
        .select(
          "id, created_at, overall_score, consistency_score, retention_score, execution_score, backlog_score",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        createdAt: row.created_at as string,
        overallScore: Number(row.overall_score ?? 0),
        consistencyScore: Number(row.consistency_score ?? 0),
        retentionScore: Number(row.retention_score ?? 0),
        executionScore: Number(row.execution_score ?? 0),
        backlogScore: Number(row.backlog_score ?? 0),
      }));
    },
  });
}
