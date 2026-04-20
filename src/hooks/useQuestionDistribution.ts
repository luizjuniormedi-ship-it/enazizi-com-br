import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import { supabase } from "@/integrations/supabase/client";
import { getCoverageStatus } from "@/lib/coverageEngine";
import { getQuestionGoalStatus } from "@/lib/questionGoalEngine";
import {
  getQuestionDistribution,
  type DistributionResult,
} from "@/lib/questionDistributionEngine";

/**
 * useQuestionDistribution — calcula a distribuição estratégica
 * de questões para o dia/semana, combinando coverage + meta + erros.
 */
export const useQuestionDistribution = () => {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const examDate = coreData?.profile?.exam_date ?? null;

  return useQuery<DistributionResult>({
    queryKey: ["question-distribution", user?.id, examDate],
    queryFn: async () => {
      const userId = user!.id;

      // Coleta sinais em paralelo, todos defensivos
      const [coverage, goal, errorCountRes] = await Promise.all([
        getCoverageStatus(userId).catch(() => null),
        getQuestionGoalStatus(userId, examDate).catch(() => null),
        supabase
          .from("error_bank")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("dominado", false)
          .then((r) => r.count ?? 0)
          .catch(() => 0),
      ]);

      const daysUntilExam = examDate
        ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000))
        : null;

      return getQuestionDistribution({
        daysUntilExam,
        coveragePct: coverage?.requiredCoveragePct,
        errorCount: errorCountRes,
        isBehindGoal: goal?.status === "behind",
        dailyTarget: goal?.daily_target,
      });
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};
