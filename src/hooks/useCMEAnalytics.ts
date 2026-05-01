import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCMEAnalytics = () => {
  const getCognitiveAnalysis = async (generationId: string) => {
    const { data, error } = await supabase
      .from("cme_cognitive_analysis")
      .select("*")
      .eq("generation_id", generationId)
      .single();
    if (error) throw error;
    return data;
  };

  const getExecutiveKPIs = async () => {
    const { data: renderJobs } = await supabase.from("cme_render_jobs").select("*");
    const { data: incidents } = await supabase.from("cme_system_incidents").select("*");
    const { data: workers } = await supabase.from("cme_worker_nodes").select("*");
    const { data: cognitive } = await supabase.from("cme_cognitive_analysis").select("*");
    const { data: neuro } = await supabase.from("cme_neuroanalytics").select("*");

    const totalRenders = renderJobs?.length || 0;
    const completedRenders = renderJobs?.filter(j => j.status === 'completed').length || 0;
    const fallbackCount = incidents?.filter(i => (i.metadata as any)?.recovery_action === 'pedagogical_fallback').length || 0;
    
    const fallbackRate = totalRenders > 0 ? (fallbackCount / totalRenders) * 100 : 0;
    
    const avgCognitiveScore = cognitive?.length 
      ? cognitive.reduce((acc, c) => acc + (c.pacing_score || 0), 0) / cognitive.length 
      : 85;

    const activeWorkers = workers?.filter(w => w.status === 'online').length || 0;

    // Métricas Neuroanalíticas (Fase Enterprise+)
    const avgEngagement = neuro?.length 
      ? neuro.reduce((acc, n) => acc + (Number(n.engagement_score) || 0), 0) / neuro.length 
      : 0;

    const avgFatigue = neuro?.length 
      ? neuro.reduce((acc, n) => acc + (Number(n.fatigue_score) || 0), 0) / neuro.length 
      : 0;

    return {
      throughput: completedRenders,
      fallbackRate: fallbackRate.toFixed(1),
      cognitiveScore: Math.round(avgCognitiveScore),
      activeWorkers,
      efficiency: activeWorkers > 0 ? 94 : 0,
      avgEngagement: Math.round(avgEngagement * 100),
      avgFatigue: Math.round(avgFatigue * 100)
    };
  };

  return { getCognitiveAnalysis, getExecutiveKPIs };
};
