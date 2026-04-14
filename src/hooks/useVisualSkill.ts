/**
 * useVisualSkill — hook to compute and persist visual skill scores.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { computeVisualSkill, type VisualSkillSummary, type AttemptRow } from "@/lib/visualSkillEngine";

export function useVisualSkill() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["visual-skill", user?.id],
    queryFn: async (): Promise<VisualSkillSummary> => {
      const { data, error } = await supabase
        .from("medical_image_attempts")
        .select("correct, time_seconds, image_type, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const attempts: AttemptRow[] = (data || []).map((r: any) => ({
        correct: r.correct,
        time_seconds: r.time_seconds,
        image_type: r.image_type,
        created_at: r.created_at,
      }));

      return computeVisualSkill(attempts);
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });
}
