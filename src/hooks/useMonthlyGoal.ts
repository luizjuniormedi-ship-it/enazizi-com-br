import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getMonthlyGoalStatus } from "@/lib/monthlyGoalEngine";

export const useMonthlyGoal = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["monthly-goal", user?.id],
    queryFn: () => getMonthlyGoalStatus(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
