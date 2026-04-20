/**
 * interventionPenaltyUpdater — Memória de Intervenção (Fase 5)
 * ─────────────────────────────────────────────────────────────
 * Helpers puros + rotina cliente-side defensiva que mantém
 * `intervention_penalties` em sincronia com `alert_events`.
 *
 * Princípios:
 *   - Penaliza apenas o **tipo de intervenção**, nunca o objetivo
 *   - Reset imediato em qualquer click
 *   - Idempotente, throttled, fail-safe (qualquer erro → no-op)
 *   - Nunca bloqueia UI (fire-and-forget)
 */
import { supabase } from "@/integrations/supabase/client";

/** Mapa nível → duração em dias. */
const LEVEL_DURATION_DAYS: Record<number, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 7,
};

/** Mapa nível → weightDelta aplicado no engine. */
export const LEVEL_WEIGHT_DELTA: Record<number, number> = {
  0: 0,
  1: -5,
  2: -10,
  3: -15,
};

/* ───────────────────────────── Helpers puros ──────────────────────────── */

/**
 * Calcula o nível de penalidade dado exposições e cliques no período.
 * Regra: clique zera; senão escala por exposições sem retorno.
 */
export function computePenaltyLevel(exposed: number, clicked: number): number {
  if (clicked > 0) return 0;
  if (exposed >= 7) return 3;
  if (exposed >= 5) return 2;
  if (exposed >= 3) return 1;
  return 0;
}

export function penaltyDurationDays(level: number): number {
  return LEVEL_DURATION_DAYS[level] ?? 0;
}

export function penaltyWeightDelta(level: number): number {
  return LEVEL_WEIGHT_DELTA[level] ?? 0;
}

/* ────────────────────────── Persistência (cliente) ─────────────────────── */

export async function upsertPenaltyForType(
  userId: string,
  type: string,
  level: number
): Promise<void> {
  if (!userId || !type) return;
  const safeLevel = Math.max(0, Math.min(3, level | 0));
  const days = penaltyDurationDays(safeLevel);
  const penaltyUntil =
    safeLevel > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error } = await supabase
    .from("intervention_penalties")
    .upsert(
      {
        user_id: userId,
        intervention_type: type,
        penalty_level: safeLevel,
        penalty_until: penaltyUntil,
        last_interaction_at: new Date().toISOString(),
      },
      { onConflict: "user_id,intervention_type" }
    );

  if (error) {
    console.warn("[penaltyUpdater] upsert falhou:", error.message);
  }
}

export async function clearPenaltyForType(
  userId: string,
  type: string
): Promise<void> {
  if (!userId || !type) return;
  const { error } = await supabase
    .from("intervention_penalties")
    .upsert(
      {
        user_id: userId,
        intervention_type: type,
        penalty_level: 0,
        penalty_until: null,
        last_interaction_at: new Date().toISOString(),
      },
      { onConflict: "user_id,intervention_type" }
    );
  if (error) {
    console.warn("[penaltyUpdater] clear falhou:", error.message);
  }
}

/* ───────────────────────── Rotina de reconciliação ─────────────────────── */

interface RawEvent {
  event_type: string;
  metadata: unknown;
}

function extractActionType(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const at = m.actionType ?? (m as Record<string, unknown>).action_type;
  return typeof at === "string" && at.length > 0 ? at : null;
}

/**
 * Throttle global por usuário (in-memory). Evita rodar mais que 1×/10min
 * por usuário durante a sessão.
 */
const lastRunAt = new Map<string, number>();
const THROTTLE_MS = 10 * 60 * 1000;

/**
 * Lê eventos recentes de intervenção (últimas 48h) para o usuário,
 * recomputa o nível de penalidade por `actionType` e aplica upserts.
 *
 * Defensivo: qualquer erro vira warning + retorno silencioso.
 */
export async function reconcileInterventionPenalties(
  userId: string,
  options: { windowHours?: number; force?: boolean } = {}
): Promise<void> {
  if (!userId) return;
  const now = Date.now();
  if (!options.force) {
    const last = lastRunAt.get(userId) ?? 0;
    if (now - last < THROTTLE_MS) return;
  }
  lastRunAt.set(userId, now);

  const windowHours = options.windowHours ?? 48;
  const sinceIso = new Date(now - windowHours * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from("alert_events")
      .select("event_type, metadata")
      .eq("source", "intervention")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .limit(2000);

    if (error) {
      console.warn("[penaltyUpdater] reconcile read falhou:", error.message);
      return;
    }

    const buckets = new Map<string, { exposed: number; clicked: number }>();
    for (const r of (data ?? []) as RawEvent[]) {
      const type = extractActionType(r.metadata);
      if (!type) continue;
      const b = buckets.get(type) ?? { exposed: 0, clicked: 0 };
      if (r.event_type === "exposed") b.exposed++;
      else if (r.event_type === "clicked") b.clicked++;
      buckets.set(type, b);
    }

    if (buckets.size === 0) return;

    // Aplica upserts em paralelo (best-effort).
    await Promise.allSettled(
      Array.from(buckets.entries()).map(([type, v]) => {
        const level = computePenaltyLevel(v.exposed, v.clicked);
        return upsertPenaltyForType(userId, type, level);
      })
    );
  } catch (e) {
    console.warn("[penaltyUpdater] reconcile crash:", (e as Error)?.message);
  }
}
