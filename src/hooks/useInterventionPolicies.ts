import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InterventionPolicy {
  id: string;
  name: string;
  trigger_type: string;
  severity_level: 'low' | 'medium' | 'high' | 'critical';
  max_per_session: number;
  max_per_day: number;
  cooldown_minutes: number;
  min_confidence_score: number;
  is_active: boolean;
  description: string;
}

export function useInterventionPolicies() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["intervention-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intervention_policies")
        .select("*")
        .order("severity_level", { ascending: false });
      if (error) throw error;
      return data as InterventionPolicy[];
    },
  });

  const togglePolicy = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("intervention_policies")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intervention-policies"] });
    },
  });

  return Object.assign(Object.create(query) as typeof query, { togglePolicy });
}
