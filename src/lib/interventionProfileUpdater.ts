/**
 * interventionProfileUpdater — Personalização por Perfil (Fase 6)
 * ────────────────────────────────────────────────────────────────
 * Helpers puros + rotina cliente-side defensiva que mantém
 * `intervention_user_profiles` em sincronia com `alert_events`.
 *
 * Princípios:
 *   - Personaliza por usuário, sem clusterização ou IA
 *   - Idempotente, throttled, fail-safe
 *   - Nunca bloqueia UI (fire-and-forget)
 */
import { supabase } from "@/integrations/supabase/client";

/* ───────────────────────────── Helpers puros ──────────────────────────── */

/**
 * profile_score = (ctr * 0.5) + (conversionRate * 0.5)
 * Valor em [0..1]. CTR = clicked/shown, conversion = resolved/clicked.
 */
export function computeProfileScore(
  shownCount: number,
  clickedCount: number,
  resolvedCount: number
): number {
  if (shownCount <= 0) return 0;
  const ctr = clickedCount / shownCount;
  const conversion = clickedCount > 0 ? resolvedCount / clickedCount : 0;
  const score = ctr * 0.5 + conversion * 0.5;
  return Math.max(0, Math.min(1, score));
}

export function computeRates(
  shownCount: number,
  clickedCount: number,
  resolvedCount: number
): { ctr: number; conversionRate: number } {
  const ctr = shownCount > 0 ? clickedCount / shownCount : 0;
  const conversionRate = clickedCount > 0 ? resolvedCount / clickedCount : 0;
  return {
    ctr: Math.max(0, Math.min(1, ctr)),
    conversionRate: Math.max(0, Math.min(1, conversionRate)),
  };
}

/* ────────────────────────── Persistência (cliente) ─────────────────────── */

export async function upsertUserInterventionProfile(
  userId: string,
  type: string,
  shownCount: number,
  clickedCount: number,
  resolvedCount: number,
  lastEventAt: string | null
): Promise<void> {
  if (!userId || !type) return;
  const { ctr, conversionRate } = computeRates(
    shownCount,
    clickedCount,
    resolvedCount
  );
  const profile_score = computeProfileScore(
    shownCount,
    clickedCount,
    resolvedCount
  );

  const { error } = await supabase
    .from("intervention_user_profiles")
    .upsert(
      {
        user_id: userId,
        intervention_type: type,
        shown_count: shownCount,
        clicked_count: clickedCount,
        resolved_count: resolvedCount,
        ctr,
        conversion_rate: conversionRate,
        profile_score,
        last_event_at: lastEventAt,
      },
      { onConflict: "user_id,intervention_type" }
    );

  if (error) {
    console.warn("[profileUpdater] upsert falhou:", error.message);
  }
}

/* ───────────────────────── Rotina de rebuild ──────────────────────────── */

interface RawEvent {
  event_type: string;
  metadata: unknown;
  created_at: string;
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
 * Lê eventos de intervenção do usuário (janela ampla — 30 dias),
 * recomputa shown/clicked/resolved/profile_score por `actionType` e
 * aplica upserts. Defensivo: qualquer erro vira warning silencioso.
 */
export async function rebuildUserInterventionProfile(
  userId: string,
  options: { windowDays?: number; force?: boolean } = {}
): Promise<void> {
  if (!userId) return;
  const now = Date.now();
  if (!options.force) {
    const last = lastRunAt.get(userId) ?? 0;
    if (now - last < THROTTLE_MS) return;
  }
  lastRunAt.set(userId, now);

  const windowDays = options.windowDays ?? 30;
  const sinceIso = new Date(
    now - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const { data, error } = await supabase
      .from("alert_events")
      .select("event_type, metadata, created_at")
      .eq("source", "intervention")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .limit(5000);

    if (error) {
      console.warn("[profileUpdater] rebuild read falhou:", error.message);
      return;
    }

    interface Bucket {
      shown: number;
      clicked: number;
      resolved: number;
      lastEventAt: string | null;
    }
    const buckets = new Map<string, Bucket>();

    for (const r of (data ?? []) as RawEvent[]) {
      const type = extractActionType(r.metadata);
      if (!type) continue;
      const b = buckets.get(type) ?? {
        shown: 0,
        clicked: 0,
        resolved: 0,
        lastEventAt: null,
      };
      if (r.event_type === "exposed") b.shown++;
      else if (r.event_type === "clicked") b.clicked++;
      else if (r.event_type === "resolved" || r.event_type === "completed") {
        b.resolved++;
      }
      if (!b.lastEventAt || r.created_at > b.lastEventAt) {
        b.lastEventAt = r.created_at;
      }
      buckets.set(type, b);
    }

    if (buckets.size === 0) return;

    await Promise.allSettled(
      Array.from(buckets.entries()).map(([type, v]) =>
        upsertUserInterventionProfile(
          userId,
          type,
          v.shown,
          v.clicked,
          v.resolved,
          v.lastEventAt
        )
      )
    );
  } catch (e) {
    console.warn("[profileUpdater] rebuild crash:", (e as Error)?.message);
  }
}
