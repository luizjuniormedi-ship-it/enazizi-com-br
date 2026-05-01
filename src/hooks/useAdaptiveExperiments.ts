import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdaptiveExperiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  target_metric: string;
  variants: Array<{ id: string; name: string }>;
  created_at: string;
}

export interface ExperimentEfficacy {
  variant_id: string;
  sample_size: number;
  avg_improvement_score: number;
  retention_lift: number;
  friction_reduction_score: number;
}

export function useAdaptiveExperiments() {
  return useQuery({
    queryKey: ["adaptive-experiments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adaptive_experiments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdaptiveExperiment[];
    },
  });
}

export function useExperimentEfficacy(experimentId?: string) {
  return useQuery({
    queryKey: ["experiment-efficacy", experimentId],
    queryFn: async () => {
      if (!experimentId) return [];
      const { data, error } = await supabase
        .from("adaptive_experiment_efficacy")
        .select("*")
        .eq("experiment_id", experimentId);
      if (error) throw error;
      return data as ExperimentEfficacy[];
    },
    enabled: !!experimentId,
  });
}
