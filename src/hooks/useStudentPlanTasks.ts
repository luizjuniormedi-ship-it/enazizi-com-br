import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Drill-down de tarefas de um aluno em um plano de Proficiência Guiada.
 * Lê professor_plan_daily_tasks (com payload) e resolve nomes de subtemas
 * em uma query auxiliar (curriculum_subtopics) — sem schema novo.
 */

export interface ProficiencyTaskRow {
  id: string;
  planned_date: string;
  task_type: string;
  status: string;
  completed_at: string | null;
  subtopic_id: string | null;
  subtopic_name: string | null;
  source: string | null;
  payload: Record<string, unknown> | null;
}

interface Params {
  planId: string | null;
  userId: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  status?: string | null;
  taskType?: string | null;
}

export function useStudentPlanTasks({
  planId,
  userId,
  fromDate,
  toDate,
  status,
  taskType,
}: Params) {
  return useQuery({
    queryKey: ["student_plan_tasks", planId, userId, fromDate, toDate, status, taskType],
    enabled: !!planId && !!userId,
    staleTime: 15_000,
    queryFn: async (): Promise<ProficiencyTaskRow[]> => {
      let q = supabase
        .from("professor_plan_daily_tasks")
        .select("id, planned_date, task_type, status, completed_at, source, task_payload")
        .eq("plan_id", planId!)
        .eq("user_id", userId!)
        .order("planned_date", { ascending: true });

      if (fromDate) q = q.gte("planned_date", fromDate);
      if (toDate) q = q.lte("planned_date", toDate);
      if (status && status !== "all") q = q.eq("status", status);
      if (taskType && taskType !== "all") q = q.eq("task_type", taskType);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const subIds = Array.from(
        new Set(
          rows
            .map((r) => (r.task_payload as any)?.subtopic_id)
            .filter((s): s is string => typeof s === "string"),
        ),
      );

      let subMap = new Map<string, string>();
      if (subIds.length > 0) {
        const { data: subs } = await supabase
          .from("curriculum_subtopics")
          .select("id, nome")
          .in("id", subIds);
        (subs ?? []).forEach((s: any) => subMap.set(s.id, s.nome));
      }

      return rows.map((r) => {
        const payload = (r.task_payload ?? null) as Record<string, unknown> | null;
        const subtopicId =
          (payload?.subtopic_id as string | undefined) ?? null;
        return {
          id: r.id,
          planned_date: r.planned_date,
          task_type: r.task_type,
          status: r.status,
          completed_at: r.completed_at,
          subtopic_id: subtopicId,
          subtopic_name: subtopicId ? subMap.get(subtopicId) ?? null : null,
          source: r.source ?? null,
          payload,
        };
      });
    },
  });
}
