import { useMutation, useQueryClient } from "@tanstack/react-query";
import { applyTrajectoryRecommendation } from "@/services/trajectory/trajectoryApi";
import { toast } from "sonner";

export function useApplyTrajectoryRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { snapshotId?: string; recommendationId: string }) =>
      applyTrajectoryRecommendation(params),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["radar-trajetoria"] });
      if (data.duplicate) {
        toast.info("Recomendação já enviada", {
          description: data.message ?? "Aguardando execução pelo Planner.",
        });
        return;
      }
      if (data.status === "applied") {
        toast.success("Recomendação aplicada", {
          description: "O Planner aceitou a proposta do Radar.",
        });
      } else {
        toast.success("Recomendação registrada", {
          description: "Aguardando execução pelo Planner Orquestrador.",
        });
      }
    },
    onError: (e: Error) => {
      toast.error("Não foi possível aplicar a recomendação", {
        description: e.message,
      });
    },
  });
}
