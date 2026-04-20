import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getCoverageStatus, type CoverageStatus } from "@/lib/coverageEngine";

export type { CoverageStatus };

/**
 * useCoverageStatus
 * ─────────────────
 * Cobertura curricular + sinal adaptativo do aluno.
 * Reusa exclusivamente fontes existentes (curriculum_matrix, temas_estudados,
 * desempenho_questoes, error_bank). Nenhuma escrita.
 *
 * staleTime alto (5 min) — cobertura muda lentamente.
 */
export function useCoverageStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["coverage-status", user?.id],
    queryFn: () => getCoverageStatus(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
