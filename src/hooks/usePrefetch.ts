import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Smart prefetch: preloads data for the next likely module
 * based on the current route. Uses requestIdleCallback to avoid
 * blocking the main thread.
 */

const MODULE_PREFETCH_MAP: Record<string, string[][]> = {
  "/dashboard": [
    ["temas_estudados"],
    ["revisoes"],
    ["practice_attempts"],
  ],
  "/cronograma": [
    ["revisoes"],
    ["temas_estudados"],
  ],
  "/simulados": [
    ["questions_bank"],
    ["simulado_sessions"],
  ],
  "/flashcards": [
    ["flashcards"],
    ["fsrs_cards"],
  ],
  "/planner": [
    ["daily_plans"],
    ["daily_plan_tasks"],
  ],
};

function scheduleIdle(fn: () => void) {
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(fn, { timeout: 3000 });
  } else {
    setTimeout(fn, 1000);
  }
}

export function usePrefetch(currentPath: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Determine which tables to prefetch based on current route
    const tables = MODULE_PREFETCH_MAP[currentPath];
    if (!tables) return;

    scheduleIdle(() => {
      tables.forEach(([table]) => {
        const queryKey = ["prefetch", table, user.id];

        // Don't refetch if already cached
        if (queryClient.getQueryData(queryKey)) return;

        queryClient.prefetchQuery({
          queryKey,
          queryFn: async () => {
            const { data } = await supabase
              .from(table as any)
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id);
            return data;
          },
          staleTime: 5 * 60 * 1000,
        });
      });
    });
  }, [currentPath, user, queryClient]);
}
