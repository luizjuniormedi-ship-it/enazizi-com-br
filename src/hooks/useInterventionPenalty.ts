/**
 * useInterventionPenalty — Memória de Intervenção (Fase 5)
 * ─────────────────────────────────────────────────────────
 * Lê `intervention_penalties` do usuário corrente e devolve um Map
 * `actionType → { level, weightDelta, penaltyUntil }`.
 *
 * - Ignora penalidades expiradas (`penalty_until <= now`)
 * - Fallback seguro para mapa vazio se sem auth, sem dados, ou erro
 * - Cache leve (60s) para não martelar o banco
 */
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import {
  penaltyWeightDelta,
  reconcileInterventionPenalties,
} from "@/lib/interventionPenaltyUpdater";

export interface InterventionPenalty {
  type: string;
  level: number;
  weightDelta: number;
  penaltyUntil: string | null;
}

interface PenaltyRow {
  intervention_type: string;
  penalty_level: number;
  penalty_until: string | null;
}

async function fetchActivePenalties(
  userId: string
): Promise<InterventionPenalty[]> {
  const { data, error } = await supabase
    .from("intervention_penalties")
    .select("intervention_type, penalty_level, penalty_until")
    .eq("user_id", userId)
    .gt("penalty_level", 0);

  if (error) {
    console.warn("[useInterventionPenalty] read falhou:", error.message);
    return [];
  }

  const now = Date.now();
  return ((data ?? []) as PenaltyRow[])
    .filter((r) => {
      if (!r.penalty_until) return false;
      const until = new Date(r.penalty_until).getTime();
      return Number.isFinite(until) && until > now;
    })
    .map((r) => ({
      type: r.intervention_type,
      level: r.penalty_level,
      weightDelta: penaltyWeightDelta(r.penalty_level),
      penaltyUntil: r.penalty_until,
    }));
}

export function useInterventionPenalty(): {
  penaltiesByType: Map<string, InterventionPenalty>;
  isLoading: boolean;
} {
  const { user } = useAuth();

  // Reconciliação throttled — atualiza penalidades com base em alert_events
  // recentes. Roda no máximo 1×/10min por usuário (controle interno).
  useEffect(() => {
    if (!user?.id) return;
    void reconcileInterventionPenalties(user.id);
  }, [user?.id]);

  const { data, isLoading } = useQuery({
    queryKey: ["intervention-penalties", user?.id],
    queryFn: () => fetchActivePenalties(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const penaltiesByType = useMemo(() => {
    const map = new Map<string, InterventionPenalty>();
    for (const p of data ?? []) map.set(p.type, p);
    return map;
  }, [data]);

  return { penaltiesByType, isLoading };
}
