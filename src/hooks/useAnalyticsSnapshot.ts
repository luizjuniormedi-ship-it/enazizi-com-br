import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AnalyticsSnapshot {
  approvalScore: number;
  prepIndex: number | null;
  chanceScore: number | null;
  pendingReviews: number;
  todayCompleted: number;
  todayTotal: number;
  streak: number;
  recoveryActive: boolean;
  contentLocked: boolean;
  phase: string | null;
  forecast_30_days?: number;
  forecast_60_days?: number;
  forecast_exam_date?: number;
}

async function fetchSnapshot(userId: string): Promise<AnalyticsSnapshot> {
  // Parallel fetch from real tables
  const today = new Date().toISOString().slice(0, 10);

  const [approvalRes, planRes, gamRes, revRes, forecastRes] = await Promise.all([
    supabase
      .from("approval_scores")
      .select("score, prep_index, chance_score, phase")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_plans")
      .select("completed_count, total_blocks, recovery_mode, content_lock")
      .eq("user_id", userId)
      .eq("plan_date", today)
      .maybeSingle(),
    supabase
      .from("user_gamification")
      .select("current_streak")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("revisoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pendente")
      .lte("data_revisao", today),
    supabase
      .from("enamed_approval_forecasts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    approvalScore: approvalRes.data?.score ?? 0,
    prepIndex: approvalRes.data?.prep_index ?? null,
    chanceScore: approvalRes.data?.chance_score ?? null,
    pendingReviews: revRes.count ?? 0,
    todayCompleted: planRes.data?.completed_count ?? 0,
    todayTotal: planRes.data?.total_blocks ?? 0,
    streak: gamRes.data?.current_streak ?? 0,
    recoveryActive: planRes.data?.recovery_mode ?? false,
    contentLocked: planRes.data?.content_lock ?? false,
    phase: approvalRes.data?.phase ?? null,
    forecast_30_days: forecastRes.data?.forecast_30_days,
    forecast_60_days: forecastRes.data?.forecast_60_days,
    forecast_exam_date: forecastRes.data?.forecast_exam_date,
  };
}

export function useAnalyticsSnapshot() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["analytics-snapshot", user?.id],
    queryFn: () => fetchSnapshot(user!.id),
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
