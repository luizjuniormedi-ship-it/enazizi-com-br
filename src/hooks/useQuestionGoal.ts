import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import { getQuestionGoalStatus, type QuestionGoalStatus } from "@/lib/questionGoalEngine";

/**
 * useQuestionGoal — janela rolante 30d (target 2000 questões)
 * Fonte: practice_attempts. Lê exam_date do coreData se disponível.
 */
export const useQuestionGoal = () => {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const examDate = coreData?.profile?.exam_date ?? null;

  return useQuery<QuestionGoalStatus>({
    queryKey: ["question-goal-30d", user?.id, examDate],
    queryFn: () => getQuestionGoalStatus(user!.id, examDate),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};
