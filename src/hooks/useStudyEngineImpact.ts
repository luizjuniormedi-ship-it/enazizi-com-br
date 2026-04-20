import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useCoreData } from "./useCoreData";
import { supabase } from "@/integrations/supabase/client";
import { getCoverageStatus } from "@/lib/coverageEngine";
import { getQuestionGoalStatus } from "@/lib/questionGoalEngine";

export type ImpactStatus = "active" | "inactive" | "insufficient_data";
export type Trend = "improving" | "stable" | "declining";

export interface EngineImpact {
  questions7d: number;
  questions30d: number;
  questionsPrev7d: number;
  coveragePct: number;
  requiredCoveragePct: number;
  criticalGapsCount: number;
  tasksCreated7d: number;
  tasksCompleted7d: number;
  completionRate7d: number;
  completionRatePrev7d: number;
  engineAdjustments: {
    coverageBoosts: number;
    goalBoosts: number;
    examPressureBoosts: number;
  };
  topActionTypes: Array<{ type: string; count: number }>;
  recentSnapshots: Array<{
    created_at: string;
    top_recommendations: any[];
    boost_totals: {
      coverageBoosts: number;
      goalBoosts: number;
      examPressureBoosts: number;
    };
  }>;
  status: ImpactStatus;
  trend: {
    questions: Trend;
    completion: Trend;
  };
}

const sinceDaysISO = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString();

function trendOf(current: number, previous: number, threshold = 0.1): Trend {
  if (previous <= 0) return current > 0 ? "improving" : "stable";
  const delta = (current - previous) / previous;
  if (delta > threshold) return "improving";
  if (delta < -threshold) return "declining";
  return "stable";
}

export const useStudyEngineImpact = () => {
  const { user } = useAuth();
  const { data: coreData } = useCoreData();
  const examDate = coreData?.profile?.exam_date ?? null;

  return useQuery<EngineImpact>({
    queryKey: ["study-engine-impact", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const userId = user!.id;

      const since7 = sinceDaysISO(7);
      const since14 = sinceDaysISO(14);

      const [
        q7,
        q30,
        qPrev7,
        coverage,
        tasks7,
        tasksDone7,
        tasksDonePrev7,
        snapshotsRes,
      ] = await Promise.all([
        supabase.from("practice_attempts").select("id", { count: "exact", head: true })
          .eq("user_id", userId).gte("created_at", since7).then(r => r.count ?? 0).catch(() => 0),
        getQuestionGoalStatus(userId, examDate).then(r => r.questions_30d).catch(() => 0),
        supabase.from("practice_attempts").select("id", { count: "exact", head: true })
          .eq("user_id", userId).gte("created_at", since14).lt("created_at", since7).then(r => r.count ?? 0).catch(() => 0),
        getCoverageStatus(userId).catch(() => null),
        supabase.from("daily_plan_tasks").select("id", { count: "exact", head: true })
          .eq("user_id", userId).gte("created_at", since7).then(r => r.count ?? 0).catch(() => 0),
        supabase.from("daily_plan_tasks").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("completed", true).gte("created_at", since7).then(r => r.count ?? 0).catch(() => 0),
        supabase.from("daily_plan_tasks").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("completed", true).gte("created_at", since14).lt("created_at", since7).then(r => r.count ?? 0).catch(() => 0),
        supabase.from("assistant_decisions")
          .select("created_at, decision_output")
          .eq("user_id", userId)
          .eq("source_module", "study-engine-v3")
          .eq("decision_type", "engine_snapshot")
          .order("created_at", { ascending: false })
          .limit(10)
          .then(r => r.data ?? [])
          .catch(() => [] as any[]),
      ]);

      const tasksCreatedPrev7 = await supabase
        .from("daily_plan_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since14)
        .lt("created_at", since7)
        .then(r => r.count ?? 0)
        .catch(() => 0);

      const completionRate7d = tasks7 > 0 ? Math.round((tasksDone7 / tasks7) * 100) : 0;
      const completionRatePrev7d = tasksCreatedPrev7 > 0
        ? Math.round((tasksDonePrev7 / tasksCreatedPrev7) * 100)
        : 0;

      // Agregação dos snapshots recentes
      const adjustments = { coverageBoosts: 0, goalBoosts: 0, examPressureBoosts: 0 };
      const typeCounter: Record<string, number> = {};
      const recentSnapshots: EngineImpact["recentSnapshots"] = [];

      for (const s of snapshotsRes as any[]) {
        const out: any = s.decision_output ?? {};
        const totals = out.boost_totals ?? {};
        adjustments.coverageBoosts += totals.coverageBoosts ?? 0;
        adjustments.goalBoosts += totals.goalBoosts ?? 0;
        adjustments.examPressureBoosts += totals.examPressureBoosts ?? 0;
        const top = out.top_recommendations ?? [];
        for (const rec of top) {
          const t = rec.type || "unknown";
          typeCounter[t] = (typeCounter[t] ?? 0) + 1;
        }
        recentSnapshots.push({
          created_at: s.created_at,
          top_recommendations: top,
          boost_totals: {
            coverageBoosts: totals.coverageBoosts ?? 0,
            goalBoosts: totals.goalBoosts ?? 0,
            examPressureBoosts: totals.examPressureBoosts ?? 0,
          },
        });
      }

      const topActionTypes = Object.entries(typeCounter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));

      const totalBoosts =
        adjustments.coverageBoosts + adjustments.goalBoosts + adjustments.examPressureBoosts;

      let status: ImpactStatus;
      if (snapshotsRes.length === 0) status = "insufficient_data";
      else if (totalBoosts === 0) status = "inactive";
      else status = "active";

      return {
        questions7d: q7,
        questions30d: q30,
        questionsPrev7d: qPrev7,
        coveragePct: coverage?.totalCoveragePct ?? 0,
        requiredCoveragePct: coverage?.requiredCoveragePct ?? 0,
        criticalGapsCount: coverage?.criticalGaps?.length ?? 0,
        tasksCreated7d: tasks7,
        tasksCompleted7d: tasksDone7,
        completionRate7d,
        completionRatePrev7d,
        engineAdjustments: adjustments,
        topActionTypes,
        recentSnapshots,
        status,
        trend: {
          questions: trendOf(q7, qPrev7),
          completion: trendOf(completionRate7d, completionRatePrev7d, 0.05),
        },
      };
    },
  });
};
