/**
 * Radar de Trajetória IA — API client (frontend → edge functions).
 * Usa supabase.functions.invoke para passar Authorization automaticamente.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  TrajectoryEngineResponse,
  TrajectoryApplyResponse,
  TrajectoryExplainResponse,
} from "@/types/trajectory";

export async function runTrajectoryEngine(
  triggerSource: string = "manual"
): Promise<TrajectoryEngineResponse> {
  const { data, error } = await supabase.functions.invoke<TrajectoryEngineResponse>(
    "trajectory-engine-v1",
    { body: { triggerSource } }
  );
  if (error) throw new Error(error.message ?? "Falha ao rodar trajectory-engine-v1");
  if (!data?.success) throw new Error(data?.error ?? "Resposta inválida do engine");
  return data;
}

export async function applyTrajectoryRecommendation(params: {
  snapshotId?: string;
  recommendationId: string;
}): Promise<TrajectoryApplyResponse> {
  const { data, error } = await supabase.functions.invoke<TrajectoryApplyResponse>(
    "trajectory-apply-v1",
    { body: params }
  );
  if (error) throw new Error(error.message ?? "Falha ao aplicar recomendação");
  if (!data?.success) throw new Error(data?.error ?? "Resposta inválida do apply");
  return data;
}

export async function explainTrajectory(params: {
  snapshotId: string;
  focus?: "general" | "risk" | "opportunity" | "scenario";
}): Promise<TrajectoryExplainResponse> {
  const { data, error } = await supabase.functions.invoke<TrajectoryExplainResponse>(
    "trajectory-explain-v1",
    { body: params }
  );
  if (error) throw new Error(error.message ?? "Falha ao gerar explicação");
  if (!data?.success) throw new Error(data?.error ?? "Resposta inválida do explain");
  return data;
}
