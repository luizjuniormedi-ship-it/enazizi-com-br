import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Batch analytics leve para múltiplos planos.
 *
 * Substitui chamadas N×N de `usePlanAnalytics` quando só precisamos dos
 * sinais agregados de risco (atrasados, meta perdida, recálculos, inativos).
 *
 * Estratégia:
 *   - 1 query em professor_plan_targets (com class_members)
 *   - 1 query em professor_plan_progress (todos os planos)
 *   - 1 query em professor_plan_recalculations (todos os planos)
 *   - agrupamento em memória por plan_id
 */

const INACTIVE_DAYS = 3;

export interface PlanRiskSummary {
  totalStudents: number;
  lateCount: number;
  missedGoalCount: number;
  totalRecalcs: number;
  inactiveCount: number;
}

export type PlansRiskMap = Record<string, PlanRiskSummary>;

async function resolveTargetsByPlan(planIds: string[]) {
  // user_id direto + class_id por plano
  const { data: targets, error } = await supabase
    .from("professor_plan_targets")
    .select("plan_id, user_id, class_id")
    .in("plan_id", planIds);
  if (error) throw error;

  const planUsers = new Map<string, Set<string>>();
  const classToPlans = new Map<string, Set<string>>();
  const allClassIds = new Set<string>();

  (targets ?? []).forEach((t: any) => {
    if (!planUsers.has(t.plan_id)) planUsers.set(t.plan_id, new Set());
    if (t.user_id) planUsers.get(t.plan_id)!.add(t.user_id);
    if (t.class_id) {
      allClassIds.add(t.class_id);
      if (!classToPlans.has(t.class_id)) classToPlans.set(t.class_id, new Set());
      classToPlans.get(t.class_id)!.add(t.plan_id);
    }
  });

  if (allClassIds.size > 0) {
    const { data: cm } = await supabase
      .from("class_members")
      .select("user_id, class_id")
      .in("class_id", Array.from(allClassIds))
      .eq("is_active", true);
    (cm ?? []).forEach((m: any) => {
      const plans = classToPlans.get(m.class_id);
      if (!plans) return;
      plans.forEach((pid) => {
        if (!planUsers.has(pid)) planUsers.set(pid, new Set());
        planUsers.get(pid)!.add(m.user_id);
      });
    });
  }

  return planUsers;
}

export function usePlansAnalyticsBatch(planIds: string[]) {
  const sortedKey = [...planIds].sort().join(",");
  return useQuery({
    queryKey: ["plans_analytics_batch", sortedKey],
    enabled: planIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<PlansRiskMap> => {
      const planUsers = await resolveTargetsByPlan(planIds);

      const [progressRes, recalcsRes] = await Promise.all([
        supabase
          .from("professor_plan_progress")
          .select(
            "plan_id, user_id, weekly_goal_status, overdue_tasks, last_activity_at",
          )
          .in("plan_id", planIds),
        supabase
          .from("professor_plan_recalculations")
          .select("plan_id")
          .in("plan_id", planIds),
      ]);

      const progressByPlan = new Map<string, Map<string, any>>();
      (progressRes.data ?? []).forEach((p: any) => {
        if (!progressByPlan.has(p.plan_id))
          progressByPlan.set(p.plan_id, new Map());
        progressByPlan.get(p.plan_id)!.set(p.user_id, p);
      });

      const recalcByPlan = new Map<string, number>();
      (recalcsRes.data ?? []).forEach((r: any) => {
        recalcByPlan.set(r.plan_id, (recalcByPlan.get(r.plan_id) ?? 0) + 1);
      });

      const inactiveCutoff = Date.now() - INACTIVE_DAYS * 86400000;
      const result: PlansRiskMap = {};

      planIds.forEach((pid) => {
        const users = planUsers.get(pid) ?? new Set<string>();
        const progMap = progressByPlan.get(pid) ?? new Map();
        let lateCount = 0;
        let missedGoalCount = 0;
        let inactiveCount = 0;

        users.forEach((uid) => {
          const p = progMap.get(uid);
          const overdue = Number(p?.overdue_tasks ?? 0);
          const weekly = p?.weekly_goal_status as string | null | undefined;
          if (overdue > 0 || weekly === "missed") lateCount += 1;
          if (weekly === "missed") missedGoalCount += 1;
          const last = p?.last_activity_at ? new Date(p.last_activity_at).getTime() : null;
          if (!last || last < inactiveCutoff) inactiveCount += 1;
        });

        result[pid] = {
          totalStudents: users.size,
          lateCount,
          missedGoalCount,
          totalRecalcs: recalcByPlan.get(pid) ?? 0,
          inactiveCount,
        };
      });

      return result;
    },
  });
}
