import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ScheduleProfile {
  preferred_session_duration: number;
  optimal_study_windows: number[];
  fatigue_threshold: number;
  drift_sensitivity: number;
  modality_preferences: Record<string, number>;
  cognitive_resilience_score: number;
  circadian_profile: string;
}

export interface WindowPerformance {
  hour_window: number;
  specialty: string;
  retention_score: number;
  stress_score: number;
  fatigue_score: number;
  drift_rate: number;
}

export function useCognitiveScheduler() {
  return useQuery({
    queryKey: ["cognitive-scheduler-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("adaptive_schedule_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as ScheduleProfile;
    },
  });
}

export function useWindowPerformance() {
  return useQuery({
    queryKey: ["cognitive-window-performance"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("cognitive_window_performance")
        .select("*")
        .eq("user_id", user.id)
        .order("hour_window", { ascending: true });

      if (error) throw error;
      return data as WindowPerformance[];
    },
  });
}
