/**
 * resetUserStudyPlan
 * ──────────────────
 * Reset MANUAL e EXPLÍCITO do plano de estudo do próprio usuário.
 *
 * Apaga apenas:
 *   - daily_plans (do user)
 *   - daily_plan_tasks (cascateado pelo daily_plan)
 *   - study_plans / study_tasks (do user)
 *   - localStorage relacionado à missão do dia
 *
 * NÃO apaga:
 *   - perfil, conta, gamificação
 *   - histórico de respostas (user_question_attempts, etc.)
 *   - banco de erros, FSRS/flashcard_reviews
 *   - simulados realizados, métricas históricas
 *   - professor_plan_daily_tasks (gerido pelo professor; RLS impede de qualquer forma)
 *
 * Após o reset, dispara `generate-daily-plan` (mesmo motor já usado por
 * recalcStudyPlanAfterProfileChange) para reconstruir o plano do zero.
 */
import { supabase } from "@/integrations/supabase/client";
import { telemetry } from "@/lib/pedagogicalTelemetry";

export interface ResetPlanResult {
  success: boolean;
  daily_plans_deleted: number;
  study_plans_deleted: number;
  regenerated: boolean;
  error?: string;
}

const LOCAL_STORAGE_KEYS = [
  "daily-mission-state",
  "daily-mission-cache",
  "current-daily-plan",
  "study-loop-state",
  "study-context",
];

export async function resetUserStudyPlan(userId: string): Promise<ResetPlanResult> {
  const isDev = import.meta.env.DEV;
  let dailyDeleted = 0;
  let studyDeleted = 0;
  let regenerated = false;
  let success = false;
  let errorMsg: string | undefined;

  // Telemetria: requested
  try {
    await telemetry.track("study_plan_reset_requested", { user_id: userId });
  } catch {}

  try {
    // 1) Apagar daily_plans (CASCADE remove daily_plan_tasks)
    const { data: dp, error: dpErr } = await supabase
      .from("daily_plans")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (dpErr) throw dpErr;
    dailyDeleted = dp?.length ?? 0;

    // 1b) Garantir limpeza de daily_plan_tasks soltas (defensivo)
    await supabase.from("daily_plan_tasks").delete().eq("user_id", userId);

    // 2) Apagar study_plans (CASCADE remove study_tasks)
    const { data: sp, error: spErr } = await supabase
      .from("study_plans")
      .delete()
      .eq("user_id", userId)
      .select("id");
    if (spErr) throw spErr;
    studyDeleted = sp?.length ?? 0;

    // 3) Limpar localStorage relacionado à missão diária / plano
    if (typeof window !== "undefined") {
      for (const key of LOCAL_STORAGE_KEYS) {
        try { window.localStorage.removeItem(key); } catch {}
      }
      // Limpar quaisquer chaves prefixadas com daily-plan / mission
      try {
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          if (
            k.startsWith("daily-plan") ||
            k.startsWith("mission") ||
            k.startsWith("study-plan") ||
            k.startsWith("study-loop")
          ) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
      } catch {}
    }

    // 4) Regenerar plano via motor oficial (idempotente)
    const { error: genErr } = await supabase.functions.invoke("generate-daily-plan", {
      body: { user_id: userId, force: true },
    });
    if (genErr) {
      // Não falhamos o reset se o regen falhar — plano será criado no próximo
      // acesso ao dashboard. Apenas registramos.
      if (isDev) console.warn("[resetUserStudyPlan] regen falhou:", genErr);
    } else {
      regenerated = true;
    }

    // 5) Dashboard snapshot (fire-and-forget)
    supabase.functions
      .invoke("dashboard-snapshot", { body: { action: "update", force: true } })
      .catch(() => {});

    success = true;
  } catch (err: any) {
    errorMsg = err?.message ?? String(err);
    if (isDev) console.error("[resetUserStudyPlan] falha:", errorMsg);
  }

  // Telemetria: completed/failed
  try {
    await telemetry.track(
      success ? "study_plan_reset_completed" : "study_plan_reset_failed",
      {
        user_id: userId,
        daily_plans_deleted: dailyDeleted,
        study_plans_deleted: studyDeleted,
        regenerated,
        error: errorMsg ?? null,
      },
    );
  } catch {}

  return {
    success,
    daily_plans_deleted: dailyDeleted,
    study_plans_deleted: studyDeleted,
    regenerated,
    error: errorMsg,
  };
}
