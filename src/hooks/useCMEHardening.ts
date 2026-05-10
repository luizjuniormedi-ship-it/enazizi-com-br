import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Override freeze: cme-ux-correct-fix (10/05/2026).
 * Telemetria técnica vai SOMENTE para o banco/console. Usuário final
 * recebe apenas mensagem amigável e neutra.
 */
export const useCMEHardening = () => {
  const reportIncident = async (component: string, error: any) => {
    // Logs técnicos: apenas console + DB. NUNCA na UI do usuário.
    console.error(`[CME Incident] ${component}:`, error);

    const { data: { user } } = await supabase.auth.getUser();

    const { error: dbError } = await supabase
      .from("cme_system_incidents")
      .insert({
        component,
        error_message: error?.message || String(error),
        stack_trace: error?.stack,
        severity: "high",
        user_id: user?.id
      });

    if (dbError) console.error("Failed to log incident:", dbError);

    // Toast amigável — sem nome de componente, sem "sistema de recuperação".
    toast.error("Ocorreu uma instabilidade temporária na geração da aula.", {
      id: "cme-incident", // de-dupe
      description: "Tente novamente em alguns instantes.",
    });
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

