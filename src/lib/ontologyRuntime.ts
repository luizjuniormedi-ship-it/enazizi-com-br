/**
 * ENAZIZI — Ontology Runtime Helper (Fase 1 — Shadow Mode)
 *
 * Freeze v25. Legacy-first. Read-only.
 *
 * Contract: see docs/ontology/GOVERNANCE_CONTRACT.md,
 *           docs/ontology/OBSERVABILITY_CONTRACT.md,
 *           docs/ontology/ONTOLOGY_CONSUMER_MATURITY_MODEL.md,
 *           docs/ontology/SAFE_ROLLBACK_CONTRACT.md.
 *
 * ABSOLUTE RULES:
 *  - This module NEVER mutates ontology.* or legacy runtime.
 *  - Every public API must fail-closed: on ANY error → legacy fallback.
 *  - Planner / FSRS / Tutor / TRI / Simulados MUST NOT import from here
 *    while Freeze v25 is active. Importers are restricted to analytics /
 *    dashboards / RFC tooling.
 */

import { supabase } from "@/integrations/supabase/client";

export type ConsumerMode =
  | "shadow_read_only"
  | "internal"
  | "beta"
  | "canary"
  | "ga";

export interface ConsumerContext {
  /** Stable consumer identifier registered in ontology.registered_consumers */
  consumerName: string;
  /** Feature name registered in ontology.consumer_feature_flags */
  featureName: string;
  /** Ontology version slug this consumer is built against (pinned constant) */
  ontologyVersionPinned: string;
}

interface SafeReadResult<T> {
  /** True only when the read succeeded AND was safe to use semantically */
  ok: boolean;
  /** Ontology data — or null if kill switch off, flag off, or any error */
  data: T | null;
  /** Why a fallback was used, if applicable */
  fallbackReason?:
    | "kill_switch_off"
    | "flag_disabled"
    | "version_mismatch"
    | "error"
    | "empty";
  /** Latency in ms */
  latencyMs: number;
}

// In-memory short cache to avoid hammering system_flags / feature_flags
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/* -------------------------------------------------------------------------- */
/*  Kill switch + flags                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Reads ontology.system_flags.ontology_runtime_enabled.
 * Fails closed: on any error → false (legacy only).
 */
export async function isOntologyRuntimeEnabled(): Promise<boolean> {
  const cached = cacheGet<boolean>("kill_switch");
  if (cached !== undefined) return cached;

  try {
    const { data, error } = await supabase
      .schema("ontology" as never)
      .from("system_flags" as never)
      .select("enabled")
      .eq("flag_name", "ontology_runtime_enabled")
      .maybeSingle();

    const enabled = !error && !!(data as { enabled?: boolean } | null)?.enabled;
    cacheSet("kill_switch", enabled);
    return enabled;
  } catch {
    cacheSet("kill_switch", false);
    return false;
  }
}

/**
 * Returns true only when:
 *  - global kill switch is on,
 *  - consumer has an active feature flag row,
 *  - flag.enabled = true,
 *  - flag.ontology_version matches the consumer's pinned version.
 *
 * Fails closed.
 */
export async function isOntologyEnabled(ctx: ConsumerContext): Promise<boolean> {
  if (!(await isOntologyRuntimeEnabled())) return false;

  const cacheKey = `flag:${ctx.consumerName}:${ctx.featureName}`;
  const cached = cacheGet<boolean>(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const { data, error } = await supabase
      .schema("ontology" as never)
      .from("consumer_feature_flags" as never)
      .select("enabled, ontology_version, rollout_percentage")
      .eq("consumer_name", ctx.consumerName)
      .eq("feature_name", ctx.featureName)
      .maybeSingle();

    if (error || !data) {
      cacheSet(cacheKey, false);
      return false;
    }
    const row = data as {
      enabled: boolean;
      ontology_version: string;
      rollout_percentage: number;
    };
    const enabled =
      row.enabled === true &&
      row.ontology_version === ctx.ontologyVersionPinned &&
      typeof row.rollout_percentage === "number" &&
      row.rollout_percentage > 0;

    cacheSet(cacheKey, enabled);
    return enabled;
  } catch {
    cacheSet(cacheKey, false);
    return false;
  }
}

/**
 * Returns the active ontology version slug, or null on any failure.
 * Consumers MUST validate it against their pinned constant.
 */
export async function getOntologyVersion(): Promise<string | null> {
  const cached = cacheGet<string | null>("active_version");
  if (cached !== undefined) return cached;

  try {
    const { data, error } = await supabase
      .schema("ontology" as never)
      .from("v_active_ontology_version" as never)
      .select("slug")
      .maybeSingle();

    const slug =
      !error && data ? (data as { slug?: string | null }).slug ?? null : null;
    cacheSet("active_version", slug);
    return slug;
  } catch {
    cacheSet("active_version", null);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Access logging                                                            */
/* -------------------------------------------------------------------------- */

interface AccessLogEntry {
  consumerName: string;
  consumerVersion?: string;
  ontologyVersion?: string | null;
  accessedView: string;
  featureFlag?: string;
  userId?: string | null;
  requestId?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget logger. Never throws, never blocks the caller.
 */
export async function logOntologyAccess(entry: AccessLogEntry): Promise<void> {
  try {
    await supabase
      .schema("ontology" as never)
      .from("ontology_access_log" as never)
      .insert({
        consumer_name: entry.consumerName,
        consumer_version: entry.consumerVersion ?? null,
        ontology_version: entry.ontologyVersion ?? null,
        accessed_view: entry.accessedView,
        feature_flag: entry.featureFlag ?? null,
        user_id: entry.userId ?? null,
        request_id: entry.requestId ?? null,
        environment: entry.environment ?? null,
        metadata: entry.metadata ?? {},
      } as never);
  } catch {
    // never surface logging failures
  }
}

/* -------------------------------------------------------------------------- */
/*  Safe ontology read for a question                                         */
/* -------------------------------------------------------------------------- */

export interface OntologyQuestionView {
  question_id: string;
  legacy_specialty_id: string | null;
  semantic_payload: Record<string, unknown> | null;
}

/**
 * Reads the ontology semantic map for a question. Fails closed.
 *
 * Consumers using this in shadow mode MUST NOT change UI / scoring /
 * ranking / scheduling based on the result. The result is observation-only.
 */
export async function safeReadOntology(
  questionId: string,
  ctx: ConsumerContext,
): Promise<SafeReadResult<OntologyQuestionView>> {
  const start = performance.now();
  const buildResult = (
    ok: boolean,
    data: OntologyQuestionView | null,
    fallbackReason?: SafeReadResult<OntologyQuestionView>["fallbackReason"],
  ): SafeReadResult<OntologyQuestionView> => ({
    ok,
    data,
    fallbackReason,
    latencyMs: Math.round(performance.now() - start),
  });

  if (!(await isOntologyRuntimeEnabled())) {
    return buildResult(false, null, "kill_switch_off");
  }
  if (!(await isOntologyEnabled(ctx))) {
    return buildResult(false, null, "flag_disabled");
  }

  const activeVersion = await getOntologyVersion();
  if (activeVersion && activeVersion !== ctx.ontologyVersionPinned) {
    return buildResult(false, null, "version_mismatch");
  }

  try {
    const { data, error } = await supabase
      .schema("ontology" as never)
      .from("v_question_semantic_map" as never)
      .select("*")
      .eq("question_id", questionId)
      .maybeSingle();

    if (error) return buildResult(false, null, "error");
    if (!data) return buildResult(false, null, "empty");

    const row = data as Record<string, unknown>;
    const view: OntologyQuestionView = {
      question_id: questionId,
      legacy_specialty_id:
        (row.specialty_id as string | null | undefined) ?? null,
      semantic_payload: row,
    };

    // Fire-and-forget observability
    void logOntologyAccess({
      consumerName: ctx.consumerName,
      ontologyVersion: activeVersion,
      accessedView: "v_question_semantic_map",
      featureFlag: ctx.featureName,
      metadata: { question_id: questionId, latency_ms: view ? view : null },
    });

    return buildResult(true, view);
  } catch {
    return buildResult(false, null, "error");
  }
}

/* -------------------------------------------------------------------------- */
/*  Legacy fallback                                                           */
/* -------------------------------------------------------------------------- */

export interface LegacyQuestionLike {
  id?: string | null;
  specialty_id?: string | null;
}

/**
 * Returns the legacy specialty_id of a question. This is the authoritative
 * source while Freeze v25 holds. Always safe to call.
 */
export function fallbackLegacySpecialty(
  question: LegacyQuestionLike | null | undefined,
): string | null {
  return question?.specialty_id ?? null;
}
