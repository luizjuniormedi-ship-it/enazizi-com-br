import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Hooks client-side para a Fase 4 da Proficiência Guiada:
 *  - useProficiencyRecalculations: lista eventos recentes do plano para o aluno
 *  - useRecalcProficiencyProgress: dispara recálculo de progresso + auto-replan
 *  - useAddPlanSubtopics: professor adiciona subtemas a plano ativo (com replan teacher_update)
 *  - useRemovePlanSubtopic: remove subtema (somente se ainda não houver tarefas concluídas dele)
 */

export type RecalculationType = "manual" | "missed_goal" | "teacher_update" | "auto";

export interface ProficiencyRecalculation {
  id: string;
  plan_id: string;
  user_id: string | null;
  recalculation_type: RecalculationType;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
}

export function useProficiencyRecalculations(planId: string | null, limit = 5) {
  return useQuery({
    queryKey: ["proficiency_recalculations", planId, limit],
    enabled: !!planId,
    staleTime: 30_000,
    queryFn: async (): Promise<ProficiencyRecalculation[]> => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("professor_plan_recalculations")
        .select("*")
        .eq("plan_id", planId!)
        .or(`user_id.eq.${uid},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ProficiencyRecalculation[];
    },
  });
}

export function useRecalcProficiencyProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, skipReplan }: { planId: string; skipReplan?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("proficiency-progress-recalc", {
        body: { planId, skipReplan: !!skipReplan },
      });
      if (error) throw error;
      return data as {
        ok: true;
        progress: {
          completed: number;
          pending: number;
          overdue: number;
          total: number;
          progressPercent: number;
          currentWeek: number;
          weeklyStatus: "done" | "partial" | "missed";
          weekDone: number;
          weekTotal: number;
        };
        replanTriggered: boolean;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student_active_proficiency_plan"] });
      qc.invalidateQueries({ queryKey: ["proficiency_daily_tasks"] });
      qc.invalidateQueries({ queryKey: ["proficiency_week_tasks"] });
      qc.invalidateQueries({ queryKey: ["proficiency_recalculations"] });
    },
  });
}

export function useAddPlanSubtopics() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      planId,
      subtopicIds,
    }: {
      planId: string;
      subtopicIds: string[];
    }) => {
      if (subtopicIds.length === 0) return { added: 0 };

      // Próximo sort_order disponível
      const { data: existing } = await supabase
        .from("professor_plan_subtopics")
        .select("sort_order, subtopic_id")
        .eq("plan_id", planId);
      const used = new Set((existing ?? []).map((r: any) => r.subtopic_id));
      const fresh = subtopicIds.filter((s) => !used.has(s));
      if (fresh.length === 0) return { added: 0 };

      const maxOrder = (existing ?? []).reduce(
        (m: number, r: any) => Math.max(m, r.sort_order ?? 0),
        0,
      );
      const rows = fresh.map((sid, i) => ({
        plan_id: planId,
        subtopic_id: sid,
        sort_order: maxOrder + 1 + i,
      }));
      const { error } = await supabase.from("professor_plan_subtopics").insert(rows);
      if (error) throw error;

      // Buscar todos os alvos do plano para disparar replanning incremental para cada um
      const { data: targets } = await supabase
        .from("professor_plan_targets")
        .select("user_id, class_id")
        .eq("plan_id", planId);

      // Resolver lista de userIds (alvos diretos + via class_members)
      const directIds = (targets ?? [])
        .map((t: any) => t.user_id)
        .filter(Boolean) as string[];
      const classIds = (targets ?? [])
        .map((t: any) => t.class_id)
        .filter(Boolean) as string[];
      let classUserIds: string[] = [];
      if (classIds.length > 0) {
        const { data: cm } = await supabase
          .from("class_members")
          .select("user_id")
          .in("class_id", classIds)
          .eq("is_active", true);
        classUserIds = (cm ?? []).map((r: any) => r.user_id);
      }
      const allUserIds = Array.from(new Set([...directIds, ...classUserIds]));

      // Disparar replan teacher_update para cada aluno (em paralelo)
      const results = await Promise.allSettled(
        allUserIds.map((uid) =>
          supabase.functions.invoke("proficiency-planner", {
            body: {
              planId,
              targetUserId: uid,
              reason: "teacher_update",
              reasonText: `Professor adicionou ${fresh.length} novo(s) subtema(s)`,
            },
          }),
        ),
      );
      const replanned = results.filter((r) => r.status === "fulfilled").length;

      return { added: fresh.length, replanned };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["professor_plans"] });
      qc.invalidateQueries({ queryKey: ["professor_plan"] });
      qc.invalidateQueries({ queryKey: ["proficiency_daily_tasks"] });
      qc.invalidateQueries({ queryKey: ["proficiency_week_tasks"] });
      qc.invalidateQueries({ queryKey: ["proficiency_recalculations"] });
      toast({
        title: "Subtemas adicionados",
        description:
          r.added > 0
            ? `${r.added} subtema(s) incorporado(s); plano replanejado para ${r.replanned ?? 0} aluno(s).`
            : "Nada a adicionar (já estavam no plano).",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Erro ao adicionar subtemas",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    },
  });
}

export function useRemovePlanSubtopic() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ planSubtopicId, subtopicId, planId }: { planSubtopicId: string; subtopicId: string; planId: string }) => {
      // Bloquear remoção se já houver tarefa concluída desse subtema
      const { data: completed } = await supabase
        .from("professor_plan_daily_tasks")
        .select("id")
        .eq("plan_id", planId)
        .eq("status", "completed")
        .contains("task_payload", { subtopic_id: subtopicId })
        .limit(1);
      if (completed && completed.length > 0) {
        throw new Error("Subtema já tem progresso concluído — não pode ser removido.");
      }

      // Apagar tarefas FUTURAS pendentes desse subtema
      const todayIso = new Date().toISOString().slice(0, 10);
      await supabase
        .from("professor_plan_daily_tasks")
        .delete()
        .eq("plan_id", planId)
        .eq("status", "pending")
        .gte("planned_date", todayIso)
        .contains("task_payload", { subtopic_id: subtopicId });

      const { error } = await supabase
        .from("professor_plan_subtopics")
        .delete()
        .eq("id", planSubtopicId);
      if (error) throw error;
      return { ok: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["professor_plans"] });
      qc.invalidateQueries({ queryKey: ["professor_plan"] });
      qc.invalidateQueries({ queryKey: ["proficiency_daily_tasks"] });
      qc.invalidateQueries({ queryKey: ["proficiency_week_tasks"] });
      toast({ title: "Subtema removido" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover subtema", description: e.message, variant: "destructive" });
    },
  });
}
