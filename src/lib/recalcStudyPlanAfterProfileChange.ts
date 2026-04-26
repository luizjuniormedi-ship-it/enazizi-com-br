/**
 * recalcStudyPlanAfterProfileChange
 * ─────────────────────────────────
 * Dispara o recálculo do plano de estudo do dia quando o usuário altera
 * exam_date, target_exam ou target_exams no Perfil.
 *
 * Estratégia para preservar progresso:
 *   1. Lê o daily_plan de hoje ANTES do regen (completed_count, completed_blocks).
 *   2. Lê IDs lógicos das tarefas concluídas (daily_plan_tasks.completed=true)
 *      por (topic, task_type) — chave estável para re-match.
 *   3. Chama `generate-daily-plan` (que faz upsert e zera contadores).
 *   4. Reaplica `completed_count`/`completed_blocks` do snapshot antigo
 *      e tenta re-marcar daily_plan_tasks com mesma (topic, task_type) como completed.
 *   5. Dispara dashboard-snapshot em paralelo.
 *
 * Falhas são silenciosas (não bloqueiam o save do perfil).
 */
import { supabase } from "@/integrations/supabase/client";
import { telemetry } from "@/lib/pedagogicalTelemetry";

export interface ExamProfileSnapshot {
  exam_date: string | null;
  target_exam: string | null;
  target_exams: string[] | null;
}

export function examProfileChanged(
  oldSnap: ExamProfileSnapshot,
  newSnap: ExamProfileSnapshot,
): boolean {
  if ((oldSnap.exam_date ?? null) !== (newSnap.exam_date ?? null)) return true;
  if ((oldSnap.target_exam ?? null) !== (newSnap.target_exam ?? null)) return true;
  const a = (oldSnap.target_exams ?? []).slice().sort().join("|");
  const b = (newSnap.target_exams ?? []).slice().sort().join("|");
  return a !== b;
}

interface RecalcResult {
  success: boolean;
  triggered_daily_plan_recalc: boolean;
  preserved_completed: number;
  error?: string;
}

export async function recalcStudyPlanAfterProfileChange(
  userId: string,
  oldSnap: ExamProfileSnapshot,
  newSnap: ExamProfileSnapshot,
): Promise<RecalcResult> {
  const isDev = import.meta.env.DEV;
  const today = new Date().toISOString().slice(0, 10);

  let preservedCount = 0;
  let triggered = false;
  let success = false;
  let errorMsg: string | undefined;

  try {
    // 1) Snapshot do daily_plan de hoje ANTES do regen
    const { data: oldPlan } = await supabase
      .from("daily_plans")
      .select("id, completed_count, completed_blocks")
      .eq("user_id", userId)
      .eq("plan_date", today)
      .maybeSingle();

    let oldCompletedKeys: Array<{ topic: string | null; task_type: string }> = [];
    if (oldPlan?.id) {
      const { data: oldTasks } = await supabase
        .from("daily_plan_tasks")
        .select("topic, task_type, completed")
        .eq("daily_plan_id", oldPlan.id)
        .eq("completed", true);
      oldCompletedKeys = (oldTasks ?? []).map((t: any) => ({
        topic: t.topic ?? null,
        task_type: t.task_type,
      }));
    }

    // 2) Regenerar plano (upsert — zera contadores)
    const { error: genErr } = await supabase.functions.invoke("generate-daily-plan", {
      body: { user_id: userId, force: true },
    });
    triggered = true;
    if (genErr) throw genErr;

    // 3) Restaurar progresso preservado
    if (oldPlan?.id && (oldCompletedKeys.length > 0 || (oldPlan.completed_count ?? 0) > 0)) {
      // Restaurar contadores agregados no daily_plans (chave única user_id+plan_date)
      await supabase
        .from("daily_plans")
        .update({
          completed_count: oldPlan.completed_count ?? 0,
          completed_blocks: oldPlan.completed_blocks ?? [],
        })
        .eq("user_id", userId)
        .eq("plan_date", today);

      // Re-marcar daily_plan_tasks com mesma (topic, task_type) como completed
      const { data: newPlan } = await supabase
        .from("daily_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("plan_date", today)
        .maybeSingle();

      if (newPlan?.id && oldCompletedKeys.length > 0) {
        const { data: newTasks } = await supabase
          .from("daily_plan_tasks")
          .select("id, topic, task_type")
          .eq("daily_plan_id", newPlan.id);

        const matches = (newTasks ?? []).filter((nt: any) =>
          oldCompletedKeys.some(
            (k) => (k.topic ?? null) === (nt.topic ?? null) && k.task_type === nt.task_type,
          ),
        );

        if (matches.length > 0) {
          const ids = matches.map((m: any) => m.id);
          await supabase
            .from("daily_plan_tasks")
            .update({ completed: true, completed_at: new Date().toISOString() })
            .in("id", ids);
          preservedCount = matches.length;
        }
      }
    }

    // 4) Dashboard snapshot (paralelo, fire-and-forget)
    supabase.functions
      .invoke("dashboard-snapshot", { body: { action: "update", force: true } })
      .catch(() => {});

    success = true;
  } catch (err: any) {
    errorMsg = err?.message ?? String(err);
    if (isDev) console.warn("[recalcStudyPlan] falha:", errorMsg);
  }

  // 5) Telemetria
  try {
    await telemetry.track("profile_exam_target_updated", {
      old_exam_date: oldSnap.exam_date,
      new_exam_date: newSnap.exam_date,
      old_target_exam: oldSnap.target_exam,
      new_target_exam: newSnap.target_exam,
      old_target_exams: oldSnap.target_exams,
      new_target_exams: newSnap.target_exams,
      triggered_daily_plan_recalc: triggered,
      preserved_completed: preservedCount,
      success,
      error: errorMsg ?? null,
    });
  } catch {
    // ignore telemetry failures
  }

  return {
    success,
    triggered_daily_plan_recalc: triggered,
    preserved_completed: preservedCount,
    error: errorMsg,
  };
}
