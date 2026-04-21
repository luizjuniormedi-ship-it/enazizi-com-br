import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fase 5 — BI da Proficiência Guiada (lado professor).
 * Reutiliza tabelas existentes (sem schema novo):
 *  - professor_plan_targets (alvos diretos + turmas)
 *  - class_members (resolve membros das turmas)
 *  - professor_plan_progress (progresso por aluno)
 *  - professor_plan_daily_tasks (tarefas)
 *  - professor_plan_recalculations (eventos)
 *  - profiles (nome/avatar)
 */

export interface PlanAnalyticsSummary {
  totalStudents: number;
  avgProgress: number;
  onTrackCount: number;
  lateCount: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalRecalcs: number;
  missedGoalRecalcs: number;
  teacherUpdateRecalcs: number;
}

export interface PlanAnalyticsStudentRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  progress_percent: number;
  weekly_goal_status: "done" | "partial" | "missed" | null;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  last_activity_at: string | null;
  recalc_count: number;
  source: "direct" | "class";
  class_id?: string | null;
}

export interface PlanAnalyticsResult {
  summary: PlanAnalyticsSummary;
  students: PlanAnalyticsStudentRow[];
  classes: { id: string; label: string }[];
}

async function resolvePlanUserIds(planId: string) {
  const { data: targets, error } = await supabase
    .from("professor_plan_targets")
    .select("user_id, class_id")
    .eq("plan_id", planId);
  if (error) throw error;

  const directIds = new Set<string>();
  const userClassMap = new Map<string, string | null>();
  const classIds: string[] = [];

  (targets ?? []).forEach((t: any) => {
    if (t.user_id) {
      directIds.add(t.user_id);
      userClassMap.set(t.user_id, null);
    }
    if (t.class_id) classIds.push(t.class_id);
  });

  let classMembers: Array<{ user_id: string; class_id: string }> = [];
  if (classIds.length > 0) {
    const { data: cm } = await supabase
      .from("class_members")
      .select("user_id, class_id")
      .in("class_id", classIds)
      .eq("is_active", true);
    classMembers = (cm ?? []) as any;
    classMembers.forEach((m) => {
      if (!userClassMap.has(m.user_id)) {
        userClassMap.set(m.user_id, m.class_id);
      }
    });
  }

  return {
    userIds: Array.from(userClassMap.keys()),
    directIds,
    classIds,
    userClassMap,
  };
}

export function usePlanAnalytics(planId: string | null) {
  return useQuery({
    queryKey: ["plan_analytics", planId],
    enabled: !!planId,
    staleTime: 30_000,
    queryFn: async (): Promise<PlanAnalyticsResult> => {
      const { userIds, directIds, classIds, userClassMap } = await resolvePlanUserIds(planId!);

      // Buscar nomes das turmas
      let classes: { id: string; label: string }[] = [];
      if (classIds.length > 0) {
        const { data: cls } = await supabase
          .from("classes")
          .select("id, name")
          .in("id", classIds);
        classes = (cls ?? []).map((c: any) => ({ id: c.id, label: c.name }));
      }

      if (userIds.length === 0) {
        return {
          summary: {
            totalStudents: 0,
            avgProgress: 0,
            onTrackCount: 0,
            lateCount: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            totalRecalcs: 0,
            missedGoalRecalcs: 0,
            teacherUpdateRecalcs: 0,
          },
          students: [],
          classes,
        };
      }

      const [progressRes, profilesRes, recalcsRes] = await Promise.all([
        supabase
          .from("professor_plan_progress")
          .select(
            "user_id, progress_percent, weekly_goal_status, completed_tasks, pending_tasks, overdue_tasks, last_activity_at",
          )
          .eq("plan_id", planId!)
          .in("user_id", userIds),
        supabase
          .from("profiles")
          .select("user_id, display_name, email, avatar_url")
          .in("user_id", userIds),
        supabase
          .from("professor_plan_recalculations")
          .select("user_id, recalculation_type")
          .eq("plan_id", planId!),
      ]);

      const progressMap = new Map<string, any>();
      (progressRes.data ?? []).forEach((p: any) => progressMap.set(p.user_id, p));
      const profileMap = new Map<string, any>();
      (profilesRes.data ?? []).forEach((p: any) => profileMap.set(p.user_id, p));

      const recalcByUser = new Map<string, number>();
      let totalRecalcs = 0;
      let missedGoalRecalcs = 0;
      let teacherUpdateRecalcs = 0;
      (recalcsRes.data ?? []).forEach((r: any) => {
        totalRecalcs += 1;
        if (r.recalculation_type === "missed_goal") missedGoalRecalcs += 1;
        if (r.recalculation_type === "teacher_update") teacherUpdateRecalcs += 1;
        if (r.user_id) recalcByUser.set(r.user_id, (recalcByUser.get(r.user_id) ?? 0) + 1);
      });

      const students: PlanAnalyticsStudentRow[] = userIds.map((uid) => {
        const prog = progressMap.get(uid);
        const prof = profileMap.get(uid);
        return {
          user_id: uid,
          display_name: prof?.display_name ?? null,
          email: prof?.email ?? null,
          avatar_url: prof?.avatar_url ?? null,
          progress_percent: Number(prog?.progress_percent ?? 0),
          weekly_goal_status: (prog?.weekly_goal_status ?? null) as any,
          completed_tasks: Number(prog?.completed_tasks ?? 0),
          pending_tasks: Number(prog?.pending_tasks ?? 0),
          overdue_tasks: Number(prog?.overdue_tasks ?? 0),
          last_activity_at: prog?.last_activity_at ?? null,
          recalc_count: recalcByUser.get(uid) ?? 0,
          source: directIds.has(uid) ? "direct" : "class",
          class_id: userClassMap.get(uid) ?? null,
        };
      });

      const totalStudents = students.length;
      const avgProgress =
        totalStudents > 0
          ? Math.round(
              students.reduce((s, x) => s + x.progress_percent, 0) / totalStudents,
            )
          : 0;
      const onTrackCount = students.filter(
        (s) => s.overdue_tasks === 0 && s.weekly_goal_status !== "missed",
      ).length;
      const lateCount = students.filter(
        (s) => s.overdue_tasks > 0 || s.weekly_goal_status === "missed",
      ).length;
      const completedTasks = students.reduce((s, x) => s + x.completed_tasks, 0);
      const pendingTasks = students.reduce((s, x) => s + x.pending_tasks, 0);
      const overdueTasks = students.reduce((s, x) => s + x.overdue_tasks, 0);

      return {
        summary: {
          totalStudents,
          avgProgress,
          onTrackCount,
          lateCount,
          completedTasks,
          pendingTasks,
          overdueTasks,
          totalRecalcs,
          missedGoalRecalcs,
          teacherUpdateRecalcs,
        },
        students,
        classes,
      };
    },
  });
}
