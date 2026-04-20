/**
 * useInterventionProfile — Personalização por Perfil (Fase 6)
 * ────────────────────────────────────────────────────────────
 * Lê `intervention_user_profiles` do usuário corrente e devolve um Map
 * `actionType → { ctr, conversionRate, profileScore, ... }`.
 *
 * - Cache 60s (não martela o banco)
 * - Dispara rebuild throttled (1×/10min) para manter fresco
 * - Fallback seguro para mapa vazio
 */
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { rebuildUserInterventionProfile } from "@/lib/interventionProfileUpdater";

export interface InterventionProfile {
  type: string;
  shownCount: number;
  clickedCount: number;
  resolvedCount: number;
  ctr: number;
  conversionRate: number;
  profileScore: number;
}

interface ProfileRow {
  intervention_type: string;
  shown_count: number;
  clicked_count: number;
  resolved_count: number;
  ctr: number;
  conversion_rate: number;
  profile_score: number;
}

async function fetchUserProfiles(
  userId: string
): Promise<InterventionProfile[]> {
  const { data, error } = await supabase
    .from("intervention_user_profiles")
    .select(
      "intervention_type, shown_count, clicked_count, resolved_count, ctr, conversion_rate, profile_score"
    )
    .eq("user_id", userId);

  if (error) {
    console.warn("[useInterventionProfile] read falhou:", error.message);
    return [];
  }

  return ((data ?? []) as ProfileRow[]).map((r) => ({
    type: r.intervention_type,
    shownCount: r.shown_count,
    clickedCount: r.clicked_count,
    resolvedCount: r.resolved_count,
    ctr: Number(r.ctr) || 0,
    conversionRate: Number(r.conversion_rate) || 0,
    profileScore: Number(r.profile_score) || 0,
  }));
}

export function useInterventionProfile(): {
  profilesByType: Map<string, InterventionProfile>;
  isLoading: boolean;
} {
  const { user } = useAuth();

  // Rebuild throttled (1×/10min) — best-effort, não bloqueia.
  useEffect(() => {
    if (!user?.id) return;
    void rebuildUserInterventionProfile(user.id);
  }, [user?.id]);

  const { data, isLoading } = useQuery({
    queryKey: ["intervention-user-profiles", user?.id],
    queryFn: () => fetchUserProfiles(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const profilesByType = useMemo(() => {
    const map = new Map<string, InterventionProfile>();
    for (const p of data ?? []) map.set(p.type, p);
    return map;
  }, [data]);

  return { profilesByType, isLoading };
}
