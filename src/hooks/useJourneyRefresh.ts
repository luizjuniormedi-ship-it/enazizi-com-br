import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Recalculates the user's journey on:
 * 1. Login (SIGNED_IN event)
 * 2. Tab regaining visibility after ≥ 2 min hidden
 * 3. Token refresh (SESSION refreshed)
 *
 * Invalidates all dashboard-related caches so every card
 * fetches fresh data from the real sources (Study Engine,
 * FSRS, error_bank, readiness, etc.).
 */

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

const JOURNEY_QUERY_KEYS = [
  ["core-data"],
  ["dashboard-data"],
  ["study-engine"],
  ["exam-readiness"],
  ["mission-mode"],
  ["daily-plan"],
  ["gamification"],
  ["mentorship"],
  ["weekly-goals"],
];

export function useJourneyRefresh() {
  const queryClient = useQueryClient();
  const hiddenAtRef = useRef<number | null>(null);

  const invalidateAll = () => {
    JOURNEY_QUERY_KEYS.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key, exact: false });
    });
  };

  // 1. Auth events — login & token refresh
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Clear stale mission from localStorage so Study Engine regenerates
        const keys = Object.keys(localStorage);
        keys.forEach((k) => {
          if (k.startsWith("enazizi_mission_")) {
            try {
              const raw = localStorage.getItem(k);
              if (!raw) return;
              const parsed = JSON.parse(raw);
              // Expire missions older than 20 hours
              if (parsed.ts && Date.now() - parsed.ts > 20 * 60 * 60 * 1000) {
                localStorage.removeItem(k);
              }
            } catch {
              // corrupted — remove
              localStorage.removeItem(k);
            }
          }
        });

        // Both SIGNED_IN and TOKEN_REFRESHED: targeted invalidation only.
        // The version-bump path (forceLoginRefresh) handles full hard-reset
        // when APP_RELEASE changes. Calling queryClient.clear() here would
        // discard the freshly-warmed core-data and force a refetch storm
        // immediately after every login.
        invalidateAll();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // 2. Visibility change — user returns after inactivity
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt >= STALE_THRESHOLD_MS) {
          invalidateAll();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [queryClient]);
}
