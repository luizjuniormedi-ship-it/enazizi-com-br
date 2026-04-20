import { useMutation } from "@tanstack/react-query";
import { explainTrajectory } from "@/services/trajectory/trajectoryApi";
import { toast } from "sonner";
import type { TrajectoryExplainResponse } from "@/types/trajectory";

export function useTrajectoryExplanation() {
  return useMutation<
    TrajectoryExplainResponse,
    Error,
    { snapshotId: string; focus?: "general" | "risk" | "opportunity" | "scenario" }
  >({
    mutationFn: (params) => explainTrajectory(params),
    onError: (e) => {
      toast.error("Não foi possível gerar a explicação", {
        description: e.message,
      });
    },
  });
}
