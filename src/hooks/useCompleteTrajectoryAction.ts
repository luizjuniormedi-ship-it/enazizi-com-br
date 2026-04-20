import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
    onSuccess: () => {
      toast.success("Ação marcada como concluída.");
      qc.invalidateQueries({ queryKey: ["radar-trajetoria"] });
      qc.invalidateQueries({ queryKey: ["radar-telemetry"] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao concluir ação.");
    },
  });
}
