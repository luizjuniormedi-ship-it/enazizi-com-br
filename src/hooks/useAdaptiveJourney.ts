import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdaptiveJourneyEvent {
  id: string;
  trigger_type: string;
  action_taken: string;
  explanation: string;
  impact_summary: string;
  cognitive_insight: string;
  friction_score_snapshot: number;
  created_at: string;
  status: string;
}

export function useAdaptiveJourney() {
  return useQuery({
    queryKey: ["adaptive-journey"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("adaptive_interventions")
        .select(`
          id,
          trigger_type,
          action_taken,
          explanation,
          impact_summary,
          cognitive_insight,
          friction_score_snapshot,
          created_at,
          status
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AdaptiveJourneyEvent[];
    },
  });
}

export function useCognitiveHistory() {
  return useQuery({
    queryKey: ["cognitive-history"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("cognitive_state_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });
}
