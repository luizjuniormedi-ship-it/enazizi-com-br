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

export interface CMERenderJob {
  id: string;
  project_id: string;
  render_type: string;
  status: string;
  priority: number;
  gpu_worker_id?: string;
  output_url?: string;
  thumbnail_url?: string;
  chapter_manifest?: any;
  reference_profile_id?: string;
  cinematic_quality_score?: number;
}

export interface CMEReferenceProfile {
  id: string;
  reference_name: string;
  reference_type: string;
  video_duration_seconds: number;
  pacing_profile: any;
  narrative_profile: any;
  cognitive_curve: any[];
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
      
      return {
        ...data,
        status: data.status as CMEProject['status']
      } as CMEProject;
    }
  });

  const renderJobsQuery = useQuery({
    queryKey: ["cme-render-jobs", projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<CMERenderJob[]> => {
      const { data, error } = await supabase
        .from("cme_render_jobs")
        .select("*")
        .eq("project_id", projectId!)
        .order("queued_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const startRender = async (projectId: string, type: string = 'full_lecture', priority: number = 50) => {
    const { data, error } = await supabase
      .from("cme_render_jobs")
      .insert({
        project_id: projectId,
        render_type: type,
        status: "queued",
        priority
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
          // @ts-ignore
          updated_at: new Date().toISOString()
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
    renderJobs: renderJobsQuery.data,
    isLoading: projectQuery.isLoading || renderJobsQuery.isLoading,
    startRender,
    updateStudentAnalytics
  };
}
