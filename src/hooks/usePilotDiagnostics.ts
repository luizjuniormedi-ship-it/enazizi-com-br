import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DiagnosticResult {
  duplicateTasks: {
    count: number;
    samples: Array<{ plan_id: string; user_id: string; planned_date: string; subtopic_id: string | null }>;
  };
  inactiveStudents: {
    count: number;
    threshold_days: 3;
  };
  recalcsLast24h: {
    teacher_update: number;
    missed_goal: number;
    auto: number;
  };
  plansActive: number;
  studentsWithActivePlan: number;
  generatedAt: string;
}

/**
 * Diagnóstico sob demanda da Proficiência Guiada.
 * Faz queries reais e leves contra o banco — não roda em loop, só quando
 * o professor clica em "Rodar diagnóstico".
 */
export function usePilotDiagnostics() {
  return useMutation<DiagnosticResult>({
    mutationFn: async () => {
      // 1) Tarefas duplicadas por (plan_id, user_id, planned_date, subtopic_id)
      // Lemos as tarefas dos últimos 60 dias para limitar payload.
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const sinceIso = since.toISOString().slice(0, 10);

      const { data: tasks, error: tErr } = await supabase
        .from("professor_plan_daily_tasks")
        .select("plan_id, user_id, planned_date, task_type, task_payload")
        .gte("planned_date", sinceIso);
      if (tErr) throw tErr;

      const dupMap = new Map<string, number>();
      for (const t of tasks ?? []) {
        const subId = (t.task_payload as { subtopic_id?: string } | null)?.subtopic_id ?? "";
        const key = `${t.plan_id}|${t.user_id}|${t.planned_date}|${t.task_type}|${subId}`;
        dupMap.set(key, (dupMap.get(key) ?? 0) + 1);
      }
      const duplicates: Array<{ plan_id: string; user_id: string; planned_date: string; subtopic_id: string | null }> = [];
      let dupCount = 0;
      for (const [key, n] of dupMap.entries()) {
        if (n > 1) {
          dupCount += n - 1;
          if (duplicates.length < 5) {
            const [plan_id, user_id, planned_date, , subtopic_id] = key.split("|");
            duplicates.push({ plan_id, user_id, planned_date, subtopic_id: subtopic_id || null });
          }
        }
      }

      // 2) Alunos inativos (>3 dias sem atividade)
      const inactiveCutoff = new Date();
      inactiveCutoff.setDate(inactiveCutoff.getDate() - 3);
      const { data: progress, error: pErr } = await supabase
        .from("professor_plan_progress")
        .select("user_id, last_activity_at");
      if (pErr) throw pErr;
      const inactiveCount = (progress ?? []).filter((p) => {
        if (!p.last_activity_at) return true;
        return new Date(p.last_activity_at) < inactiveCutoff;
      }).length;

      // 3) Recálculos nas últimas 24h por tipo
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { data: recalcs, error: rErr } = await supabase
        .from("professor_plan_recalculations")
        .select("recalculation_type, created_at")
        .gte("created_at", yesterday.toISOString());
      if (rErr) throw rErr;
      const byType = { teacher_update: 0, missed_goal: 0, auto: 0 };
      for (const r of recalcs ?? []) {
        const k = r.recalculation_type as keyof typeof byType;
        if (k in byType) byType[k] += 1;
      }

      // 4) Planos ativos + alunos cobertos
      const { count: plansActive } = await supabase
        .from("professor_plans")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const { data: targets } = await supabase
        .from("professor_plan_targets")
        .select("user_id");
      const uniqUsers = new Set(
        (targets ?? []).map((t) => t.user_id).filter(Boolean) as string[],
      );

      return {
        duplicateTasks: { count: dupCount, samples: duplicates },
        inactiveStudents: { count: inactiveCount, threshold_days: 3 },
        recalcsLast24h: byType,
        plansActive: plansActive ?? 0,
        studentsWithActivePlan: uniqUsers.size,
        generatedAt: new Date().toISOString(),
      };
    },
  });
}
