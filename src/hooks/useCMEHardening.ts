import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useCMEHardening = () => {
  const reportIncident = async (component: string, error: any) => {
    console.error(`[CME Incident] ${component}:`, error);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error: dbError } = await supabase
      .from("cme_system_incidents")
      .insert({
        component,
        error_message: error.message || String(error),
        stack_trace: error.stack,
        severity: "high",
        user_id: user?.id
      });

    if (dbError) console.error("Failed to log incident:", dbError);
    
    toast.error(`Falha no componente ${component}. O sistema de recuperação foi acionado.`);
  };

  const createSnapshot = async (renderJobId: string, step: string, state: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase
      .from("cme_pipeline_snapshots")
      .insert({
        render_job_id: renderJobId,
        step_name: step,
        state_data: state,
        user_id: user?.id
      });
  };

  return { reportIncident, createSnapshot };
};
