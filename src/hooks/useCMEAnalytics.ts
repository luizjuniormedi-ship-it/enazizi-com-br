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
    const { data: renderStats, error: renderError } = await supabase
      .from("cme_render_jobs")
      .select("status, created_at");
    
    // Process stats for dashboard
    return { renderStats };
  };

  return { getCognitiveAnalysis, getExecutiveKPIs };
};
