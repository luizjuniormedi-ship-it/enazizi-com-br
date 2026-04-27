import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { emitShadowEvent, logShadowOutcome } from "@/lib/shadowAdaptive";

export function useCompleteTrajectoryAction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { appliedActionId: string; durationMinutes?: number; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke("trajectory-complete-action-v1", {
        body: vars,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      toast.success("Ação marcada como concluída.");
      qc.invalidateQueries({ queryKey: ["radar-trajetoria"] });
      qc.invalidateQueries({ queryKey: ["radar-telemetry"] });
      // Shadow Adaptive Layer (Fase 3A) — observacional. NÃO recalcula planner.
      void emitShadowEvent({
        module: "planner",
        event: "task_completed",
        durationMs: vars.durationMinutes ? vars.durationMinutes * 60_000 : null,
        extra: { action_id: vars.appliedActionId },
      });
      void logShadowOutcome({
        module: "planner",
        action: "completed",
        durationMs: vars.durationMinutes ? vars.durationMinutes * 60_000 : null,
      });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao concluir ação.");
    },
  });
}
