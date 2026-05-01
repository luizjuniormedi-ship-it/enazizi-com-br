import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useAutoScaling = () => {
  const queryClient = useQueryClient();

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ["cme-cluster-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_cluster_metrics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000
  });

  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ["cme-autoscaling-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_autoscaling_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  const logScalingEvent = useMutation({
    mutationFn: async (params: {
      action: string,
      workerCountBefore: number,
      workerCountAfter: number,
      reason: string,
      metadata?: any
    }) => {
      const { error } = await supabase
        .from("cme_autoscaling_events")
        .insert({
          action: params.action,
          worker_count_before: params.workerCountBefore,
          worker_count_after: params.workerCountAfter,
          reason: params.reason,
          metadata: params.metadata
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cme-autoscaling-events"] });
    }
  });

  return {
    metrics,
    events,
    isLoading: loadingMetrics || loadingEvents,
    logScalingEvent
  };
};