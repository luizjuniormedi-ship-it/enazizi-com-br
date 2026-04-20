import { useMutation, useQueryClient } from "@tanstack/react-query";
import { runTrajectoryEngine } from "@/services/trajectory/trajectoryApi";
import { toast } from "sonner";

export function useRunTrajectoryEngine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (triggerSource: string = "manual") => runTrajectoryEngine(triggerSource),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radar-trajetoria"] });
      toast.success("Análise atualizada", {
        description: "Snapshot e cenários recalculados.",
      });
    },
    onError: (e: Error) => {
      toast.error("Não foi possível atualizar a análise", {
        description: e.message,
      });
    },
  });
}
