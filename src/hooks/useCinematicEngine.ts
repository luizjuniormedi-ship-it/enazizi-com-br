import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CMEProject {
  id: string;
  title: string;
  topic_id: string;
  status: 'draft' | 'planning' | 'scripting' | 'rendering' | 'published' | 'failed';
  target_audience: string;
  config: any;
  created_at: string;
  updated_at: string;
}

export interface CMESemanticPlan {
  id: string;
  project_id: string;
  semantic_outline: any;
  prerequisite_graph: any;
  cognitive_difficulty_map: any;
  clinical_priority_points: string[];
  exam_priority_points: string[];
  retention_hotspots: any;
}

export interface CMENarrativeScript {
  id: string;
  project_id: string;
  cinematic_script: any;
  chapters: any;
  pacing_hints: any;
}

export function useCinematicEngine(projectId?: string) {
  const { user } = useAuth();

  const projectQuery = useQuery({
    queryKey: ["cme-project", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<CMEProject> => {
      const { data, error } = await supabase
        .from("cme_video_projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    }
  });

  const semanticPlanQuery = useQuery({
    queryKey: ["cme-semantic-plan", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<CMESemanticPlan> => {
      const { data, error } = await supabase
        .from("cme_semantic_plans")
        .select("*")
        .eq("project_id", projectId!)
        .single();
      if (error) throw error;
      return data;
    }
  });

  const analyticsQuery = useQuery({
    queryKey: ["cme-analytics", projectId, user?.id],
    enabled: !!projectId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_multimodal_analytics")
        .select("*")
        .eq("project_id", projectId!)
        .eq("student_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const startGeneration = async (topicId: string, title: string) => {
    const { data, error } = await supabase
      .from("cme_video_projects")
      .insert({
        title,
        topic_id: topicId,
        status: "planning"
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const updateStudentAnalytics = async (projectId: string, metrics: {
    watch_time_seconds?: number;
    replay_count?: number;
    completion_rate?: number;
    avg_pacing_efficiency?: number;
    stress_spikes?: any[];
    chapter_retention?: any;
  }) => {
    if (!user) return;

    const { data: existing } = await supabase
      .from("cme_multimodal_analytics")
      .select("id, watch_time_seconds, replay_count")
      .eq("project_id", projectId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("cme_multimodal_analytics")
        .update({
          watch_time_seconds: (existing.watch_time_seconds || 0) + (metrics.watch_time_seconds || 0),
          replay_count: (existing.replay_count || 0) + (metrics.replay_count || 0),
          completion_rate: metrics.completion_rate,
          avg_pacing_efficiency: metrics.avg_pacing_efficiency,
          stress_spikes: metrics.stress_spikes,
          chapter_retention: metrics.chapter_retention,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("cme_multimodal_analytics")
        .insert({
          project_id: projectId,
          student_id: user.id,
          ...metrics
        });
      if (error) throw error;
    }
  };

  return {
    project: projectQuery.data,
    semanticPlan: semanticPlanQuery.data,
    studentAnalytics: analyticsQuery.data,
    isLoading: projectQuery.isLoading || semanticPlanQuery.isLoading,
    startGeneration,
    updateStudentAnalytics
  };
}
