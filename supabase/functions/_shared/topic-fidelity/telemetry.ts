/**
 * TOPIC FIDELITY TELEMETRY — Fase 2 (observacional, fire-and-forget)
 *
 * Persiste cada classificação em `topic_fidelity_telemetry`. Nunca trava
 * o caller — falha silenciosa. Respeita feature flag `TOPIC_FIDELITY_TELEMETRY`.
 */
import type { TopicFidelityResult } from "./topic-resolver.ts";

let flagCache: { value: boolean; expiresAt: number } | null = null;

async function isTelemetryEnabled(supabaseAdmin: any): Promise<boolean> {
  const now = Date.now();
  if (flagCache && flagCache.expiresAt > now) return flagCache.value;
  try {
    const { data } = await supabaseAdmin
      .from("system_flags")
      .select("enabled")
      .eq("flag_key", "TOPIC_FIDELITY_TELEMETRY")
      .maybeSingle();
    const value = data?.enabled !== false; // default true
    flagCache = { value, expiresAt: now + 60_000 }; // 60s cache
    return value;
  } catch {
    return true; // fail-open
  }
}

export async function recordTopicFidelity(
  supabaseAdmin: any,
  params: {
    source: string;
    userId?: string | null;
    result: TopicFidelityResult;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    if (!(await isTelemetryEnabled(supabaseAdmin))) return;
    const r = params.result;
    await supabaseAdmin.from("topic_fidelity_telemetry").insert({
      user_id: params.userId ?? null,
      source: params.source,
      raw_input: (r.rawInput || "").slice(0, 500),
      resolved_specialty: r.specialty,
      resolved_system: r.system,
      resolved_topic: r.topic,
      resolved_subtopic: r.subtopic,
      granularity_level: r.level,
      is_generic: r.isGeneric,
      is_granular: r.isGranular,
      was_blocked: false, // FASE 2 — sempre false
      suggestions: r.suggestions,
      confidence: r.confidence,
      matched_via: r.matchedVia,
      metadata: params.metadata ?? {},
    });
  } catch (e: any) {
    console.warn("[TOPIC_FIDELITY_TELEMETRY_ERROR]", e?.message);
  }
}
