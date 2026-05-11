import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { completeStudyAction } from "@/lib/completeStudyAction";

/**
 * Cliente para o modo `plannerMode = "proficiencia"`.
 *
 * - useGenerateProficiencyPlan: invoca a edge function que distribui subtemas
 *   em professor_plan_daily_tasks (idempotente).
 * - useProficiencyDailyTasks: lê o plano diário do aluno para uma data.
 * - useProficiencyWeekTasks: lê uma janela de 7 dias para a timeline.
 * - useUpdateProficiencyTaskStatus: marca tarefa concluída/skipped.
 */

export type ProficiencyTaskStatus = "pending" | "completed" | "skipped" | "overdue";
export type ProficiencyTaskType = "theory" | "questions" | "review" | string;

export interface ProficiencyDailyTask {
  id: string;
  plan_id: string;
  user_id: string;
  planned_date: string;
  task_type: ProficiencyTaskType;
  task_payload: {
    subtopic_id?: string;
    subtopic_name?: string;
    topic_id?: string | null;
    target_count?: number;
    fsrs_assist?: boolean;
    [k: string]: unknown;
  };
  status: ProficiencyTaskStatus;
  source: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useGenerateProficiencyPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase.functions.invoke("proficiency-planner", {
        body: { planId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        ok: true;
        planId: string;
        examDate: string;
        daysUntil: number;
        intensity: string;
        studyDays: number;
        subtopicsCount: number;
        generatedTasks: number;
        insertedTasks: number;
        skippedDuplicates: number;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["proficiency_daily_tasks"] });
      qc.invalidateQueries({ queryKey: ["proficiency_week_tasks"] });
      qc.invalidateQueries({ queryKey: ["student_active_proficiency_plan"] });
      toast({
        title: "Cronograma gerado",
        description: `${data.insertedTasks} novas tarefas em ${data.studyDays} dias úteis.`,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Falha ao gerar cronograma",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    },
  });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function useProficiencyDailyTasks(planId: string | null, date?: string) {
  const today = date ?? isoDate(new Date());
  return useQuery({
    queryKey: ["proficiency_daily_tasks", planId, today],
    enabled: !!planId,
    queryFn: async (): Promise<ProficiencyDailyTask[]> => {
      const { data, error } = await supabase
        .from("professor_plan_daily_tasks")
        .select("*")
        .eq("plan_id", planId!)
        .eq("planned_date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProficiencyDailyTask[];
    },
  });
}

export function useProficiencyWeekTasks(planId: string | null, fromDate?: string, days = 14) {
  const start = fromDate ?? isoDate(new Date());
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + days);
  const end = isoDate(endDate);
  return useQuery({
    queryKey: ["proficiency_week_tasks", planId, start, end],
    enabled: !!planId,
    queryFn: async (): Promise<ProficiencyDailyTask[]> => {
      const { data, error } = await supabase
        .from("professor_plan_daily_tasks")
        .select("*")
        .eq("plan_id", planId!)
        .gte("planned_date", start)
        .lt("planned_date", end)
        .order("planned_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProficiencyDailyTask[];
    },
  });
}

export function useUpdateProficiencyTaskStatus() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ 
      taskId, 
      status, 
      task // Optional task object for telemetry/FSRS
    }: { 
      taskId: string; 
      status: ProficiencyTaskStatus;
      task?: ProficiencyDailyTask;
    }) => {
      const update = {
        status,
        ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      };
      
      // 1. Database Update
      const { error } = await supabase
        .from("professor_plan_daily_tasks")
        .update(update)
        .eq("id", taskId);
      if (error) throw error;

      // 2. Telemetry/FSRS signal (only if completing)
      if (status === "completed" && task) {
        try {
          await completeStudyAction({
            userId: task.user_id,
            professorPlanTaskId: taskId,
            taskType: "professor_plan",
            topic: task.task_payload?.subtopic_name || "Subtema",
            subtopic: task.task_payload?.subtopic_name,
            source: "manual",
            originModule: "proficiency-guided-panel",
            metadata: {
              planId: task.plan_id,
              proficiencyTaskType: task.task_type
            }
          });
        } catch (e) {
          console.warn("[useUpdateProficiencyTaskStatus] completeStudyAction failed:", e);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proficiency_daily_tasks"] });
      qc.invalidateQueries({ queryKey: ["proficiency_week_tasks"] });
    },
    onError: (e: any) =>
      toast({ title: "Erro", description: e?.message ?? String(e), variant: "destructive" }),
  });
}
