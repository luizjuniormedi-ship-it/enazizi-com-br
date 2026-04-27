/**
 * resetUserStudyPlan
 * ──────────────────
 * Reset MANUAL e EXPLÍCITO do plano de estudo do próprio usuário.
 *
 * Apaga / reseta apenas a JORNADA ATUAL:
 *   - daily_plans (do user)
 *   - daily_plan_tasks (cascateado pelo daily_plan)
 *   - study_plans / study_tasks (do user)
 *   - module_sessions com status='active' → marcadas como 'abandoned'
 *     (zera "Continuar de onde parou" em flashcards, simulados,
 *     image-quiz, anamnese, clinical-simulation, study-session etc.)
 *   - dashboard_snapshots (marcado como stale → forçar reconstrução)
 *   - localStorage da missão diária / planner / loop / focus / EOD
 *   - sessionStorage de "Continuar" (ENAFLIX origin/lastModule, study_session)
 *
 * NÃO apaga (preserva histórico pedagógico):
 *   - perfil, conta, gamificação, streak, XP
 *   - histórico de respostas (user_question_attempts)
 *   - banco de erros, FSRS / flashcard_reviews
 *   - flashcards, mapas mentais, mnemônicos, simulados realizados
 *   - chat_conversations (histórico do Tutor — última conversa pode
 *     continuar aparecendo no StartHereCard, é histórico pedagógico)
 *   - métricas históricas, ranking, progresso cognitivo real
 *   - professor_plan_daily_tasks (gerido pelo professor; RLS impede)
 *   - module_sessions com status='completed' ou 'abandoned' (auditoria)
 *
 * Após o reset, dispara `generate-daily-plan` para reconstruir o plano do zero.
 * NÃO recria snapshot — deixa o próximo render do dashboard regenerá-lo
 * naturalmente sobre o plano novo.
 */
import { supabase } from "@/integrations/supabase/client";
import { telemetry } from "@/lib/pedagogicalTelemetry";
import { invalidateDashboardSnapshot } from "@/lib/dashboardSnapshot";

export interface ResetPlanResult {
  success: boolean;
  daily_plans_deleted: number;
  study_plans_deleted: number;
  regenerated: boolean;
  error?: string;
}

/**
 * Chaves localStorage CONHECIDAS que cacheiam estado de plano/missão/loop.
 * Mantemos lista explícita + sweep por prefixo para resiliência.
 */
const LOCAL_STORAGE_KEYS = [
  // Mission (chave real usada por useMissionMode)
  "enazizi-mission-state",
  // Possíveis caches legados / outros loops
  "daily-mission-state",
  "daily-mission-cache",
  "current-daily-plan",
  "study-loop-state",
  "study-context",
  // Recovery e snapshots derivados
  "enazizi-heavy-recovery",
  "enazizi_daily_focus",
  "enazizi_eod_summary_date",
  "enazizi_weekly_snap_ts",
];

/**
 * Prefixos que cobrem chaves dinâmicas (ex.: `enazizi:mission:2026-04-27`).
 * IMPORTANTE: usar tanto separadores `-` quanto `:` quanto `_` —
 * a aba "Continuar" do sidebar usa `enazizi:mission:YYYY-MM-DD`
 * (NÃO coberto por prefixo `enazizi-mission`).
 */
const LOCAL_STORAGE_PREFIXES = [
  "daily-plan",
  "daily_plan",
  "mission",
  "enazizi-mission",
  "enazizi_mission",
  "enazizi:mission",
  "study-plan",
  "study_plan",
  "study-loop",
  "enazizi_study_session",
  "enazizi-weekly-snap",
];

/**
 * Chaves sessionStorage que apontam pra "Continuar de onde parou".
 * Limpamos pra que o sidebar/EnaflixBackButton não voltem ao estado anterior.
 */
const SESSION_STORAGE_KEYS = [
  "enazizi_study_session",
  "enaflix:origin",
  "enaflix:lastModule",
];

function clearPlanLocalStorage(): void {
  if (typeof window === "undefined") return;
  // 1) chaves explícitas
  for (const key of LOCAL_STORAGE_KEYS) {
    try { window.localStorage.removeItem(key); } catch {}
  }
  // 2) varredura por prefixo (cobre `enazizi:mission:YYYY-MM-DD` etc.)
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
  // 3) sessionStorage — Continuar / ENAFLIX origin
  for (const key of SESSION_STORAGE_KEYS) {
    try { window.sessionStorage.removeItem(key); } catch {}
  }
}

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
    const resetAt = new Date().toISOString();

    // 0) Marcador seguro de corte da jornada atual. Histórico continua salvo,
    // mas cards de Hoje/Continuar passam a ignorar itens anteriores ao reset.
    await supabase
      .from("profiles")
      .update({ last_study_plan_reset_at: resetAt })
      .eq("user_id", userId);

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

    // 2b) Garantir limpeza defensiva de tasks legadas soltas.
    try {
      await supabase.from("study_tasks").delete().eq("user_id", userId);
    } catch (e) {
      if (isDev) console.warn("[resetUserStudyPlan] delete study_tasks falhou:", e);
    }

    // 3) Marcar TODAS as sessões ativas (`module_sessions`) como
    //    `abandoned` para que a aba/banner "Continuar de onde parou"
    //    não exiba retomada de sessão antiga em flashcards, simulados,
    //    image-quiz, anamnese, clinical-simulation, study-session etc.
    //    NÃO apaga o registro: preserva histórico/auditoria.
    try {
      await supabase
        .from("module_sessions")
        .update({ status: "abandoned" })
        .eq("user_id", userId)
        .eq("status", "active");
    } catch (e) {
      if (isDev) console.warn("[resetUserStudyPlan] abandon module_sessions falhou:", e);
    }

    // 3b) Encerrar estados derivados ATUAIS da jornada, sem apagar histórico.
    try {
      await supabase
        .from("recovery_runs" as any)
        .update({ active: false, ended_at: resetAt } as any)
        .eq("user_id", userId)
        .eq("active", true);

      await supabase
        .from("trajectory_applied_actions" as any)
        .update({ status: "reset", updated_at: resetAt } as any)
        .eq("user_id", userId)
        .in("status", ["pending", "pending_orchestrator", "applied", "accepted", "in_progress"]);
    } catch (e) {
      if (isDev) console.warn("[resetUserStudyPlan] reset derived current state falhou:", e);
    }

    // 4) Marcar dashboard_snapshots como STALE (não apaga histórico,
    //    apenas força próxima leitura a recomputar o snapshot).
    //    CRÍTICO: useDashboardData usa fast-path de 5min via snapshot.
    invalidateDashboardSnapshot(userId);
    await supabase
      .from("dashboard_snapshots")
      .update({ updated_at: "2000-01-01T00:00:00Z" })
      .eq("user_id", userId);

    // 5) Limpar localStorage / sessionStorage relacionado a plano / missão / continuar
    clearPlanLocalStorage();

    // 6) Regenerar plano via motor oficial (idempotente).
    //    Importante: rodar DEPOIS da invalidação do snapshot, para que
    //    quando o dashboard recomputar ele já encontre o plano novo.
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

    // 7) NÃO chamar dashboard-snapshot { action: 'update' } aqui —
    //    isso reescreveria o snapshot com possível leitura intermediária
    //    do banco e congelaria por até 5 min novamente.
    //    O próximo render do dashboard reconstrói via useDashboardData.

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

/**
 * Lista canônica de queryKeys do React Query que dependem do plano atual.
 * Usado pelo componente UI para invalidar TUDO após o reset.
 *
 * Mantida em sync com `useRefreshUserState` (contexto "all") + extras.
 */
export const PLAN_RELATED_QUERY_KEYS: readonly string[] = [
  // Dashboard core
  "core-data",
  "dashboard-data",
  "dashboard-snapshot",
  "dashboard-mnemonic",
  "sidebar-pending",
  "bottom-tab-pending",
  "coverage-status",
  "monthly-goal",
  // Plano diário / hoje
  "daily-plan",
  "daily-plan-tasks",
  "daily_plans",
  "daily_plan_tasks",
  "mission-mode",
  // Engine pedagógico (queries observacionais — não altera motor real)
  "study-engine",
  "study-engine-impact",
  "study-orchestrator",
  "study-next",
  "cockpit-data",
  // Indicadores derivados
  "exam-readiness",
  "weekly-goals",
  "preparation-index",
  "smart-notifications",
  "approval-score-latest",
  "approval-timeline",
  "domain-map-thermo",
  "topic-evolution",
  "specialty-progress",
  "daily-goal",
  // Trajetória / radar
  "radar-trajetoria",
  "trajectory-applied-actions",
  "radar-telemetry",
  "radar-snapshot-history",
  // Snapshots de análise
  "analytics-snapshot",
  // Reforço / FSRS (lê tarefas planejadas)
  "revisoes",
  "fsrs-cards",
  "error-bank",
] as const;
