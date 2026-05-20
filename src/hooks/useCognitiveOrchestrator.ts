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

      // We use adaptive_student_profiles as the source of truth for metrics
      const { data: profile, error: profError } = await supabase
        .from("adaptive_student_profiles")
        .select("cognitive_stress_index, fatigue_index, overall_friction_score, response_speed_index, current_session_mode")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profError) throw profError;

      // And cognitive_states for the qualitative state
      const { data: cogState } = await supabase
        .from("cognitive_states")
        .select("state")
        .eq("user_id", user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        stress_index: profile?.cognitive_stress_index || 0,
        fatigue_index: profile?.fatigue_index || 0,
        overload_risk: profile?.overall_friction_score || 0,
        response_speed_index: profile?.response_speed_index || 0,
        current_session_mode: (profile?.current_session_mode as SessionMode) || 'balanced',
        state: cogState?.state || 'novato',
        retention_score: 50 // Placeholder
      };
    },
  });

  const updateMode = useMutation({
    mutationFn: async (mode: SessionMode) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase
        .from("adaptive_student_profiles")
        .update({ 
          current_session_mode: mode,
          recovery_mode_active: mode === 'recovery'
        })
        .eq("user_id", user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cognitive-orchestration"] });
      queryClient.invalidateQueries({ queryKey: ["core-data"] });
    },
  });

  return { ...query, updateMode };
}
