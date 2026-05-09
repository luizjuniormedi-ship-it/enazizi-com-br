import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { invalidateDashboardSnapshot } from "@/lib/dashboardSnapshot";

/**
 * Refresh contexts — escopo limita o blast radius de invalidação.
 * - "question"  → questão respondida (erros + progresso + plano diário)
 * - "review"    → revisão FSRS (cards + revisoes)
 * - "session"   → sessão de estudo finalizada (mais amplo, ainda não tudo)
 * - "all"       → fallback legacy (mantém comportamento original)
 */
export type RefreshContext = "question" | "review" | "session" | "all";

const CONTEXT_KEYS: Record<RefreshContext, string[]> = {
  question: [
    "error-bank",
    "daily-plan-tasks",
    "study-engine",
    "preparation-index",
    "gamification",
  ],
  review: [
    "fsrs-cards",
    "revisoes",
    "daily-plan-tasks",
    "preparation-index",
  ],
  session: [
    "core-data",
    "dashboard-data",
    "study-engine",
    "cockpit-data",
    "exam-readiness",
    "weekly-goals",
    "preparation-index",
    "mission-mode",
    "daily-plan",
    "smart-notifications",
    "gamification",
    "revisoes",
    "fsrs-cards",
    "error-bank",
    "daily-plan-tasks",
  ],
  all: [
    "core-data",
    "dashboard-data",
    "study-engine",
    "cockpit-data",
    "dashboard-mnemonic",
    "exam-readiness",
    "weekly-goals",
    "preparation-index",
    "mission-mode",
    "daily-plan",
    "smart-notifications",
    "gamification",
    "revisoes",
    "fsrs-cards",
    "error-bank",
    "daily-plan-tasks",
  ],
};

// Debounce window for heavy side-effects (snapshot rebuild, streak update)
const SIDE_EFFECT_DEBOUNCE_MS = 2500;

let lastSideEffectAt = 0;
let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Central hook para invalidação de cache pós-ação de estudo.
 * Agora aceita escopos para reduzir refetches em cascata.
 *
 * Uso recomendado:
 *   refresh("question")  // questão respondida
 *   refresh("review")    // revisão FSRS
 *   refresh("session")   // fim de sessão
 *
 * Para compatibilidade, `refreshAll()` continua existindo (= escopo "all").
 */
export function useRefreshUserState() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const lastInvalidationAt = useRef(0);

  const runSideEffects = useCallback(
    (uid: string) => {
      // Streak + dashboard snapshot rebuild + weekly snapshot
      // Debounced — múltiplas ações em sequência só disparam um update.
      const now = Date.now();
      if (now - lastSideEffectAt < SIDE_EFFECT_DEBOUNCE_MS) {
        if (pendingTimeout) clearTimeout(pendingTimeout);
        pendingTimeout = setTimeout(
          () => runSideEffects(uid),
          SIDE_EFFECT_DEBOUNCE_MS
        );
        return;
      }
      lastSideEffectAt = now;

      import("@/lib/activityLogger").then(({ updateStreak }) => {
        updateStreak(uid).then(() => {
          queryClient.invalidateQueries({ queryKey: ["streak-banner"] });
          queryClient.invalidateQueries({ queryKey: ["streak-calendar"] });
        });
      });

      import("@/integrations/supabase/client").then(({ supabase }) => {
        supabase.functions
          .invoke("dashboard-snapshot", { body: { action: "update" } })
          .then(() => {});
      });

      // Weekly snapshot — só roda 1x por hora
      const lastSave = localStorage.getItem("enazizi_weekly_snap_ts");
      if (lastSave && Date.now() - Number(lastSave) < 3600_000) return;
      localStorage.setItem("enazizi_weekly_snap_ts", String(Date.now()));

      import("@/lib/weeklySnapshot").then(({ saveWeeklySnapshot }) => {
        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase
            .from("daily_plans")
            .select(
              "plan_json, completed_blocks, completed_count, total_blocks, approval_score, prep_index"
            )
            .eq("user_id", uid)
            .order("plan_date", { ascending: false })
            .limit(7)
            .then(async ({ data: plans }) => {
              if (!plans?.length) return;
              // Loop 2: normaliza plan_json (v2 canônico, array legado, objeto com blocks)
              const { extractPlanTasks } = await import("@/lib/planner/normalizePlanJson");
              const planned = plans.flatMap((p) => extractPlanTasks(p.plan_json));
              const completed = plans.flatMap((p) => {
                const c = p.completed_blocks as any;
                return Array.isArray(c) ? c : [];
              });
              const latest = plans[0];
              saveWeeklySnapshot(uid, {
                plannedTasks: planned,
                completedTasks: completed,
                carryover: [],
                approvalScore: latest.approval_score ?? undefined,
                prepIndex: latest.prep_index ?? undefined,
              });
            });
        });
      });
    },
    [queryClient]
  );

  const refresh = useCallback(
    (ctx: RefreshContext = "session") => {
      // Coalesce múltiplas chamadas no mesmo tick (~250ms)
      const now = Date.now();
      if (now - lastInvalidationAt.current < 250) return;
      lastInvalidationAt.current = now;

      const keys = CONTEXT_KEYS[ctx];
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

      if (user?.id) {
        invalidateDashboardSnapshot(user.id);
        runSideEffects(user.id);
      }
    },
    [queryClient, user?.id, runSideEffects]
  );

  // Compatibilidade com chamadas existentes
  const refreshAll = useCallback(() => refresh("all"), [refresh]);

  return { refresh, refreshAll };
}
