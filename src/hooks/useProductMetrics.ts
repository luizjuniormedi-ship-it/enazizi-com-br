/**
 * useProductMetrics — queries aggregated product data for dashboards
 * Designed for admin/CEO panels to answer:
 * - Who studies? Who abandons? Where does the system fail?
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LoopFunnelMetrics {
  totalStarts: number;
  totalCompletes: number;
  totalAbandons: number;
  completionRate: number;
  abandonRate: number;
  totalAnswers: number;
  totalCorrect: number;
  accuracy: number;
  quickActionsUsed: number;
  reinforcements: number;
  elegantExits: number;
  errors: number;
  avgStudySeconds: number;
}

export interface DailyEngagementRow {
  metric_date: string;
  loops_started: number;
  loops_completed: number;
  loops_abandoned: number;
  questions_answered: number;
  questions_correct: number;
  quick_actions_used: number;
  total_study_seconds: number;
  reinforcements_triggered: number;
  elegant_exits: number;
  errors_encountered: number;
  sessions_count: number;
}

export interface UserRetentionRow {
  user_id: string;
  active_days: number;
  total_loops: number;
  total_completes: number;
  last_active: string;
}

/** Aggregated funnel metrics for a date range (admin) */
export function useLoopFunnelMetrics(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["loop-funnel", startDate, endDate],
    queryFn: async (): Promise<LoopFunnelMetrics> => {
      const { data, error } = await (supabase as any)
        .from("user_engagement_daily")
        .select("loops_started, loops_completed, loops_abandoned, questions_answered, questions_correct, quick_actions_used, total_study_seconds, reinforcements_triggered, elegant_exits, errors_encountered")
        .gte("metric_date", startDate)
        .lte("metric_date", endDate);

      if (error) throw error;
      const rows = (data || []) as DailyEngagementRow[];

      const sum = (key: keyof DailyEngagementRow) =>
        rows.reduce((acc, r) => acc + ((r[key] as number) || 0), 0);

      const starts = sum("loops_started");
      const completes = sum("loops_completed");
      const abandons = sum("loops_abandoned");
      const answers = sum("questions_answered");
      const correct = sum("questions_correct");
      const studySeconds = sum("total_study_seconds");

      return {
        totalStarts: starts,
        totalCompletes: completes,
        totalAbandons: abandons,
        completionRate: starts > 0 ? Math.round((completes / starts) * 100) : 0,
        abandonRate: starts > 0 ? Math.round((abandons / starts) * 100) : 0,
        totalAnswers: answers,
        totalCorrect: correct,
        accuracy: answers > 0 ? Math.round((correct / answers) * 100) : 0,
        quickActionsUsed: sum("quick_actions_used"),
        reinforcements: sum("reinforcements_triggered"),
        elegantExits: sum("elegant_exits"),
        errors: sum("errors_encountered"),
        avgStudySeconds: rows.length > 0 ? Math.round(studySeconds / rows.length) : 0,
      };
    },
    staleTime: 60_000,
  });
}

/** Daily engagement trend for charts (admin) */
export function useDailyEngagementTrend(days: number = 30) {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["engagement-trend", days],
    queryFn: async (): Promise<DailyEngagementRow[]> => {
      const { data, error } = await (supabase as any)
        .from("user_engagement_daily")
        .select("metric_date, loops_started, loops_completed, loops_abandoned, questions_answered, questions_correct, quick_actions_used, total_study_seconds, reinforcements_triggered, elegant_exits, errors_encountered, sessions_count")
        .gte("metric_date", startDate)
        .lte("metric_date", endDate)
        .order("metric_date", { ascending: true });

      if (error) throw error;

      // Aggregate by date (multiple users → sum per day)
      const byDate = new Map<string, DailyEngagementRow>();
      for (const row of (data || []) as DailyEngagementRow[]) {
        const existing = byDate.get(row.metric_date);
        if (existing) {
          existing.loops_started += row.loops_started || 0;
          existing.loops_completed += row.loops_completed || 0;
          existing.loops_abandoned += row.loops_abandoned || 0;
          existing.questions_answered += row.questions_answered || 0;
          existing.questions_correct += row.questions_correct || 0;
          existing.quick_actions_used += row.quick_actions_used || 0;
          existing.total_study_seconds += row.total_study_seconds || 0;
          existing.reinforcements_triggered += row.reinforcements_triggered || 0;
          existing.elegant_exits += row.elegant_exits || 0;
          existing.errors_encountered += row.errors_encountered || 0;
          existing.sessions_count += row.sessions_count || 0;
        } else {
          byDate.set(row.metric_date, { ...row });
        }
      }

      return Array.from(byDate.values());
    },
    staleTime: 60_000,
  });
}

/** Per-user retention data for the last N days (admin) */
export function useUserRetention(days: number = 30) {
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  return useQuery({
    queryKey: ["user-retention", days],
    queryFn: async (): Promise<UserRetentionRow[]> => {
      const { data, error } = await (supabase as any)
        .from("user_engagement_daily")
        .select("user_id, metric_date, loops_started, loops_completed")
        .gte("metric_date", startDate);

      if (error) throw error;

      const byUser = new Map<string, { dates: Set<string>; starts: number; completes: number; lastDate: string }>();
      for (const row of (data || []) as any[]) {
        const u = byUser.get(row.user_id) || { dates: new Set(), starts: 0, completes: 0, lastDate: "" };
        u.dates.add(row.metric_date);
        u.starts += row.loops_started || 0;
        u.completes += row.loops_completed || 0;
        if (row.metric_date > u.lastDate) u.lastDate = row.metric_date;
        byUser.set(row.user_id, u);
      }

      return Array.from(byUser.entries()).map(([user_id, d]) => ({
        user_id,
        active_days: d.dates.size,
        total_loops: d.starts,
        total_completes: d.completes,
        last_active: d.lastDate,
      }));
    },
    staleTime: 60_000,
  });
}
