import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useAdaptiveLoop() {
  const { user } = useAuth();

  const logIntervention = async (params: {
    trigger_type: string;
    action_taken: string;
    context_node_id?: string;
    video_lesson_id?: string;
    friction_score_snapshot: number;
    recommendation_text: string;
    action_payload?: any;
    status?: 'shadow' | 'pending' | 'accepted' | 'ignored';
  }) => {
    if (!user) return;

    const { error } = await supabase
      .from("adaptive_interventions")
      .insert({
        user_id: user.id,
        ...params,
      });

    if (error) {
      console.error("Failed to log intervention:", error);
    }
  };

  const logPathAdjustment = async (params: {
    trigger_reason: string;
    original_path_node_id?: string;
    new_path_node_id: string;
    adjustment_type: 'reroute' | 'reorder' | 'insert_remediation';
    metadata?: any;
  }) => {
    if (!user) return;

    const { error } = await supabase
      .from("adaptive_path_logs")
      .insert({
        user_id: user.id,
        ...params,
      });

    if (error) {
      console.error("Failed to log path adjustment:", error);
    }
  };

  return { logIntervention, logPathAdjustment };
}
