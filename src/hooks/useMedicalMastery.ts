import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MasteryMetric {
  node_name: string;
  theoretical_score: number;
  clinical_score: number;
  retention_stability: number;
  speed_factor: number;
  dependency_factor: number;
  transfer_score: number;
  overload_risk: number;
  retention_projection: number;
  false_mastery_risk: number;
  last_updated_at: string;
}

export function useMedicalMastery() {
  return useQuery({
    queryKey: ["medical-mastery"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("student_mastery_metrics")
        .select(`
          theoretical_score,
          clinical_score,
          retention_stability,
          speed_factor,
          dependency_factor,
          transfer_score,
          overload_risk,
          retention_projection,
          false_mastery_risk,
          last_updated_at,
          knowledge_nodes (
            name
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      return (data || []).map((m: any) => ({
        ...m,
        node_name: m.knowledge_nodes?.name || "Desconhecido",
      })) as MasteryMetric[];
    },
  });
}
