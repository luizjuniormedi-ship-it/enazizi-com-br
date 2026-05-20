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
        .from("cognitive_states")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Fallback for legacy data/profile structure
      if (!data) {
        const { data: profile } = await supabase
          .from("adaptive_student_profiles")
          .select("cognitive_stress_index, fatigue_index, overload_risk, response_speed_index, current_session_mode")
          .eq("user_id", user.id)
          .maybeSingle();
        
        return {
          stress_index: profile?.cognitive_stress_index || 0,
          fatigue_index: profile?.fatigue_index || 0,
          overload_risk: profile?.overload_risk || 0,
          response_speed_index: profile?.response_speed_index || 0,
          current_session_mode: (profile?.current_session_mode as SessionMode) || 'balanced',
          state: 'novato',
          retention_score: 50
        };
      }

      return {
        stress_index: data.error_pressure || 0,
        fatigue_index: data.fatigue_level || 0,
        overload_risk: data.cognitive_load || 0,
        response_speed_index: data.response_speed_index || 0,
        current_session_mode: data.state === 'recuperacao' ? 'recovery' : 'balanced',
        state: data.state,
        retention_score: data.retention_score
      };
    },
  });

  const updateMode = useMutation({
    mutationFn: async (mode: SessionMode) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update both for compatibility
      await Promise.all([
        supabase
          .from("adaptive_student_profiles")
          .update({ 
            current_session_mode: mode,
            recovery_mode_active: mode === 'recovery'
          })
          .eq("user_id", user.id),
        supabase
          .from("cognitive_states")
          .update({ 
            state: mode === 'recovery' ? 'recuperacao' : undefined 
          })
          .eq("user_id", user.id)
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cognitive-orchestration"] });
      queryClient.invalidateQueries({ queryKey: ["core-data"] });
    },
  });

  return { ...query, updateMode };
}
