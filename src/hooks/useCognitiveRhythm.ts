import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CognitiveRhythm {
  hour_of_day: number;
  day_of_week: number;
  avg_stress_index: number;
  avg_accuracy: number;
  avg_fatigue_index: number;
  retention_efficiency: number;
}

export interface LongitudinalPatterns {
  optimal_hours: number[];
  fatigue_threshold_min: number;
  circadian_profile: string;
}

export function useCognitiveRhythm() {
  return useQuery({
    queryKey: ["cognitive-rhythm"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("cognitive_rhythm_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("hour_of_day", { ascending: true });

      if (error) throw error;
      return data as CognitiveRhythm[];
    },
  });
}

export function useLongitudinalProfile() {
  return useQuery({
    queryKey: ["longitudinal-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("adaptive_student_profiles")
        .select("longitudinal_patterns, drift_score, circadian_intelligence_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return {
        patterns: (data?.longitudinal_patterns as unknown as LongitudinalPatterns) || {},
        driftScore: data?.drift_score || 0,
        circadianActive: data?.circadian_intelligence_active ?? false
      };
    },
  });
}
