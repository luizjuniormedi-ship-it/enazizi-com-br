import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SessionMode = 'silent' | 'balanced' | 'intense' | 'recovery';

export interface CognitiveState {
  stress_index: number;
  fatigue_index: number;
  overload_risk: number;
  response_speed_index: number;
  current_session_mode: SessionMode;
}

export function useCognitiveOrchestrator() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["cognitive-orchestration"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("adaptive_student_profiles")
        .select("cognitive_stress_index, fatigue_index, overload_risk, response_speed_index, current_session_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CognitiveState;
    },
  });

  const updateMode = useMutation({
    mutationFn: async (mode: SessionMode) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("adaptive_student_profiles")
        .update({ 
          current_session_mode: mode,
          recovery_mode_active: mode === 'recovery'
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cognitive-orchestration"] });
      queryClient.invalidateQueries({ queryKey: ["core-data"] });
    },
  });

  return { ...query, updateMode };
}
