import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useNeuroanalytics = (projectId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["cme-adaptive-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_adaptive_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: session, isLoading: loadingSession } = useQuery({
    queryKey: ["cme-streaming-session", user?.id, projectId],
    enabled: !!user && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_streaming_sessions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("project_id", projectId!)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    }
  });

  const trackViewing = useMutation({
    mutationFn: async (params: { 
      projectId: string, 
      sessionId?: string, 
      startTime: number, 
      endTime: number, 
      playbackSpeed: number,
      interactionType: string 
    }) => {
      const { error } = await supabase
        .from("cme_viewing_analytics")
        .insert({
          user_id: user!.id,
          project_id: params.projectId,
          session_id: params.sessionId,
          timestamp_start: params.startTime,
          timestamp_end: params.endTime,
          playback_speed: params.playbackSpeed,
          interaction_type: params.interactionType
        });
      
      if (error) throw error;
    }
  });

  const updateNeuroanalytics = useMutation({
    mutationFn: async (params: {
      projectId: string,
      fatigueScore: number,
      cognitiveLoad: number,
      engagementScore: number,
      retentionPrediction: number,
      abandonmentRisk: number
    }) => {
      const { error } = await supabase
        .from("cme_neuroanalytics")
        .insert({
          user_id: user!.id,
          generation_id: params.projectId,
          fatigue_score: params.fatigueScore,
          cognitive_load: params.cognitiveLoad,
          engagement_score: params.engagementScore,
          retention_prediction: params.retentionPrediction,
          abandonment_risk: params.abandonmentRisk
        });
      
      if (error) throw error;
    }
  });

  return {
    profile,
    session,
    isLoading: loadingProfile || loadingSession,
    trackViewing,
    updateNeuroanalytics
  };
};