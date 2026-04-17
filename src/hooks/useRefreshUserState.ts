import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { invalidateDashboardSnapshot } from "@/lib/dashboardSnapshot";

/**
 * Central hook for refreshing ALL user-facing state after any study action.
 * Invalidates every cache that feeds dashboard, mission, pending reviews, etc.
 *
 * Use after: finishing questions, reviews, simulados, flashcards, tutor sessions,
 * clinical simulations, anamnesis, practical exams, and any study module completion.
 */
export function useRefreshUserState() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const refreshAll = useCallback(() => {
    // Core data sources
    queryClient.invalidateQueries({ queryKey: ["core-data"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    queryClient.invalidateQueries({ queryKey: ["study-engine"] });
    queryClient.invalidateQueries({ queryKey: ["cockpit-data"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-mnemonic"] });

    // Readiness & progress
    queryClient.invalidateQueries({ queryKey: ["exam-readiness"] });
    queryClient.invalidateQueries({ queryKey: ["weekly-goals"] });
    queryClient.invalidateQueries({ queryKey: ["preparation-index"] });

    // Mission & plan
    queryClient.invalidateQueries({ queryKey: ["mission-mode"] });
    queryClient.invalidateQueries({ queryKey: ["daily-plan"] });

    // Module-specific caches
    queryClient.invalidateQueries({ queryKey: ["smart-notifications"] });
    queryClient.invalidateQueries({ queryKey: ["gamification"] });

    // Data tables used by study engine
    queryClient.invalidateQueries({ queryKey: ["revisoes"] });
    queryClient.invalidateQueries({ queryKey: ["fsrs-cards"] });
    queryClient.invalidateQueries({ queryKey: ["error-bank"] });
    queryClient.invalidateQueries({ queryKey: ["daily-plan-tasks"] });

    // Persistent snapshot
    if (user?.id) {
      invalidateDashboardSnapshot(user.id);
    }

    // Async: streak update + snapshot rebuild + weekly snapshot (fire-and-forget)
    if (user?.id) {
      const uid = user.id;

      // Update streak
      import("@/lib/activityLogger").then(({ updateStreak }) => {
        updateStreak(uid).then(() => {
          queryClient.invalidateQueries({ queryKey: ["streak-banner"] });
          queryClient.invalidateQueries({ queryKey: ["streak-calendar"] });
        });
      });

      import("@/integrations/supabase/client").then(({ supabase }) => {
        supabase.functions.invoke("dashboard-snapshot", {
          body: { action: "update" },
        }).then(() => {});
      });

      // Save weekly snapshot periodically (non-blocking)
      import("@/lib/weeklySnapshot").then(({ saveWeeklySnapshot }) => {
        // Only save if we haven't saved in the last hour
        const lastSave = localStorage.getItem("enazizi_weekly_snap_ts");
        if (lastSave && Date.now() - Number(lastSave) < 3600_000) return;
        localStorage.setItem("enazizi_weekly_snap_ts", String(Date.now()));

        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase.from("daily_plans")
            .select("plan_json, completed_blocks, completed_count, total_blocks, approval_score, prep_index")
            .eq("user_id", uid)
            .order("plan_date", { ascending: false })
            .limit(7)
            .then(({ data: plans }) => {
              if (!plans?.length) return;
              const planned = plans.flatMap(p => {
                const j = p.plan_json as any;
                return Array.isArray(j) ? j : [];
              });
              const completed = plans.flatMap(p => {
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
    }
  }, [queryClient, user?.id]);

  return { refreshAll };
}
