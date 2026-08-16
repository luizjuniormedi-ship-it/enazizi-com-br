/**
 * useOrchestrator — F1 (shadow mode)
 *
 * Invokes study-orchestrator in parallel to study-next.
 * In shadow mode the response is fetched + cached but UI consumption is opt-in.
 * F3 will plug this into CockpitHero with a safe fallback to useStudyNext.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { OrchestratorResponse } from "@/types/orchestrator";

async function fetchOrchestrator(shadowMode = false): Promise<OrchestratorResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const { data, error } = await supabase.functions.invoke("study-orchestrator", {
    body: { shadowMode },
  });

  if (error) throw new Error(error.message || "Erro no orquestrador");
  return data as OrchestratorResponse;
}

interface UseOrchestratorOptions {
  /** When true (default in F1), still fetches but flags shadowMode in payload. */
  shadow?: boolean;
  /** When false, the query stays disabled (useful before F3 rollout). */
  enabled?: boolean;
}

export function useOrchestrator(opts: UseOrchestratorOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const shadow = opts.shadow ?? false;
  const enabled = (opts.enabled ?? true) && !!user;

  const query = useQuery({
    queryKey: ["study-orchestrator", user?.id, shadow],
    queryFn: () => fetchOrchestrator(shadow),
    enabled,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["study-orchestrator"] });

  return Object.assign(Object.create(query) as typeof query, { refresh });
}
