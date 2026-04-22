import { useQuery } from "@tanstack/react-query";
import {
  buildExamDistributionFromCurriculum,
  type ExamDistributionTree,
} from "@/lib/examDistributionFromCurriculum";

/**
 * Hook React Query que carrega a distribuição dinâmica de temas para um
 * perfil + total de questões. Cacheia por 10 min (os pesos curriculares
 * mudam raramente).
 *
 * Sempre devolve uma `ExamDistributionTree` válida — em caso de falha ou
 * banca sem cobertura, vem `source: "fallback_static"` (gerada localmente
 * sem promessa rejeitada).
 */
export function useExamDistribution(
  profileKey: string | null | undefined,
  totalQuestions: number,
) {
  return useQuery<ExamDistributionTree>({
    queryKey: ["exam-distribution", profileKey ?? "GERAL", totalQuestions],
    queryFn: () =>
      buildExamDistributionFromCurriculum(profileKey ?? "GERAL", totalQuestions),
    enabled: totalQuestions > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
