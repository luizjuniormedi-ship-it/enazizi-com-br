/**
 * Global AI content cache utilities — Loop 4A v2.
 *
 * Two layers (back-compat preserved):
 *  - Legacy:  buildCacheKey / getCachedContent / setCachedContent / logAiUsage
 *             (kept exactly as before so existing callers don't break).
 *  - v2:      buildPromptHash / getCachedAIResponse / saveAIResponseToCache
 *             / logAIUsage  — scope-aware (user|global), TTL per module,
 *             cache_status (hit/miss/miss_expired/bypass), tokens_saved
 *             & cost_saved bookkeeping.
 *
 * Scope rules (enforced in code AND by DB CHECK constraint):
 *   - scope='user'   ⇒ user_id REQUIRED. Never returned to other users.
 *   - scope='global' ⇒ user_id MUST be null. Only for fully generic content.
 *
 * Personal markers that auto-force user-scope:
 *   userId, history, errors, error_bank, performance, fsrs, studentProfile,
 *   dailyPlan, userContext, avoidStatements (non-empty).
 *
 * Never store: success=false, audit-rejected, fallback (unless source flagged).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ───── TTL per module (days) ────────────────────────────────────────
export const CACHE_TTL_DAYS: Record<string, number> = {
  mnemonic: 90,
  question_general: 30,
  question_banca: 15,
  tutor_user: 7,
  planner: 1,
  report: 7,
  blueprint: 30,
  default: 30,
};

// ───── Cost table per 1k tokens (rough) ─────────────────────────────
const COST_PER_1K: Record<string, number> = {
  "openai/gpt-5-mini": 0.005,
  "openai/gpt-5-mini-mini": 0.0003,
  "openai/gpt-5-mini-nano": 0.0001,
  "openai/gpt-5-mini": 0.005,
  "openai/gpt-5-mini-mini": 0.0003,
  "google/gemini-2.5-pro": 0.0035,
  "google/gemini-2.5-flash": 0.0003,
  "google/gemini-2.5-flash-lite": 0.0001,
  "google/gemini-3-flash-preview": 0.0003,
};

function estimateCost(model: string | undefined, tokens: number): number {
  const rate = COST_PER_1K[model || ""] || 0.0005;
  return (tokens / 1000) * rate;
}

// ───── Stable JSON & SHA-256 hash ──────────────────────────────────
function stableStringify(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Build a deterministic semantic hash from any JSON-serialisable payload. */
export async function buildPromptHash(payload: unknown): Promise<string> {
  return await sha256Hex(stableStringify(payload));
}

// ───── Scope detection ─────────────────────────────────────────────
const PERSONAL_KEYS = new Set([
  "userid", "user_id", "history", "errors", "error_bank", "errorbank",
  "performance", "fsrs", "studentprofile", "student_profile",
  "dailyplan", "daily_plan", "usercontext", "user_context",
  "avoidstatements",
]);

/** Returns true when payload carries any personal marker. */
export function hasPersonalSignals(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  for (const k of Object.keys(payload as Record<string, unknown>)) {
    const norm = k.toLowerCase();
    if (PERSONAL_KEYS.has(norm)) {
      const v = (payload as any)[k];
      if (v == null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === "string" && !v.trim()) continue;
      return true;
    }
  }
  return false;
}

// ───── v2 API ──────────────────────────────────────────────────────
export type CacheScope = "user" | "global";

export interface GetCacheParams {
  module: string;
  scope: CacheScope;
  userId?: string | null;
  semanticHash: string;
  contentType?: string;
}

export interface CacheLookupResult {
  hit: boolean;
  expired: boolean;
  content: any | null;
  modelUsed?: string | null;
  cachedAt?: string | null;
}

/** Look up cached AI response respecting scope. Never cross-user-leaks. */
export async function getCachedAIResponse(p: GetCacheParams): Promise<CacheLookupResult> {
  try {
    if (p.scope === "user" && !p.userId) {
      console.warn("[ai-cache] user scope without userId — refusing lookup");
      return { hit: false, expired: false, content: null };
    }
    const sb = getSupabaseAdmin();
    const contentType = p.contentType || `${p.module}_v2`;
    let q = sb.from("ai_content_cache")
      .select("id, content_json, model_used, expires_at, created_at, hit_count")
      .eq("module", p.module)
      .eq("scope", p.scope)
      .eq("semantic_hash", p.semanticHash)
      .eq("content_type", contentType)
      .order("created_at", { ascending: false })
      .limit(1);
    if (p.scope === "user") q = q.eq("user_id", p.userId!);
    else q = q.is("user_id", null);

    const { data, error } = await q.maybeSingle();
    if (error || !data) return { hit: false, expired: false, content: null };

    const expiresAt = new Date(data.expires_at).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
      return { hit: false, expired: true, content: null, modelUsed: data.model_used, cachedAt: data.created_at };
    }
    // Fire-and-forget hit_count++
    sb.from("ai_content_cache")
      .update({ hit_count: (data as any).hit_count + 1 || 1 })
      .eq("id", data.id)
      .then(() => {});
    return { hit: true, expired: false, content: data.content_json, modelUsed: data.model_used, cachedAt: data.created_at };
  } catch (e) {
    console.warn("[ai-cache] getCachedAIResponse failed:", e);
    return { hit: false, expired: false, content: null };
  }
}

export interface SaveCacheParams {
  module: string;
  scope: CacheScope;
  userId?: string | null;
  semanticHash: string;
  response: any;
  modelUsed?: string;
  ttlDays?: number;
  contentType?: string;
  specialty?: string;
  topic?: string;
  banca?: string;
  difficulty?: number;
  /** When true, refuses to write (e.g. on error / fallback / audit-rejected). */
  skip?: boolean;
}

/** Persist AI response in cache. Refuses if response is missing or skip=true. */
export async function saveAIResponseToCache(p: SaveCacheParams): Promise<void> {
  try {
    if (p.skip) return;
    if (!p.response) return;
    if (p.scope === "user" && !p.userId) {
      console.warn("[ai-cache] refusing user-scope save without userId");
      return;
    }
    if (p.scope === "global" && hasPersonalSignals(p.response)) {
      console.warn("[ai-cache] refusing global save: personal signals detected in response payload");
      return;
    }
    const sb = getSupabaseAdmin();
    const ttl = p.ttlDays ?? CACHE_TTL_DAYS[p.module] ?? CACHE_TTL_DAYS.default;
    const expiresAt = new Date(Date.now() + ttl * 86400000).toISOString();
    const contentType = p.contentType || `${p.module}_v2`;
    // Cache_key is unique per (cache_key, content_type) — embed scope+hash+user.
    const cacheKey = [
      p.module,
      p.scope,
      p.userId || "_",
      p.semanticHash,
    ].join("::");

    await sb.from("ai_content_cache").upsert(
      {
        cache_key: cacheKey,
        content_type: contentType,
        content_json: p.response,
        model_used: p.modelUsed || "unknown",
        expires_at: expiresAt,
        hit_count: 0,
        module: p.module,
        scope: p.scope,
        user_id: p.scope === "user" ? p.userId : null,
        semantic_hash: p.semanticHash,
        normalized_prompt_hash: p.semanticHash,
        specialty: p.specialty || null,
        topic: p.topic || null,
        banca: p.banca || null,
        difficulty: p.difficulty ?? null,
      },
      { onConflict: "cache_key,content_type" },
    );
  } catch (e) {
    console.warn("[ai-cache] saveAIResponseToCache failed (non-critical):", e);
  }
}

export type CacheStatus = "hit" | "miss" | "miss_expired" | "bypass" | "disabled";

export interface LogAIUsageParams {
  userId?: string | null;
  module: string;
  functionName?: string;
  model?: string;
  cacheStatus?: CacheStatus;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokensUsed?: number;
  tokensSaved?: number;
  costSaved?: number;
  requestId?: string;
  success?: boolean;
  errorMessage?: string;
  modelTier?: string;
  promptType?: string;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Insert a usage row aligned to current ai_usage_logs schema. Never throws. */
export async function logAIUsage(p: LogAIUsageParams): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const isUuid = !!(p.userId && UUID_RX.test(p.userId));
    const tokens = p.tokensUsed ?? ((p.inputTokens || 0) + (p.outputTokens || 0));
    const cost = estimateCost(p.model, tokens);
    const tokensSaved = p.tokensSaved ?? (p.cacheStatus === "hit" ? tokens : 0);
    const costSaved = p.costSaved ?? (p.cacheStatus === "hit" ? cost : 0);

    await sb.from("ai_usage_logs").insert({
      user_id: isUuid ? p.userId : null,
      model: p.model || "unknown",
      model_used: p.model || "unknown",
      module: p.module,
      function_name: p.functionName || p.module,
      cache_status: p.cacheStatus || null,
      cache_hit: p.cacheStatus === "hit",
      reused_from_cache: p.cacheStatus === "hit",
      input_tokens: p.inputTokens ?? null,
      output_tokens: p.outputTokens ?? null,
      tokens_used: tokens || null,
      tokens_saved: tokensSaved,
      cost_estimate: cost,
      cost_saved: costSaved,
      estimated_cost: cost,
      latency_ms: p.latencyMs ?? null,
      response_time_ms: p.latencyMs ?? null,
      request_id: p.requestId || null,
      success: p.success ?? true,
      error_message: p.errorMessage || null,
      model_tier: p.modelTier || "standard",
      prompt_type: p.promptType || null,
      actor_type: isUuid ? "user" : "system",
      actor_key: isUuid ? null : (p.userId || "system"),
    });
  } catch (e) {
    console.warn("[ai-cache] logAIUsage insert failed:", e);
  }
}

// ═════════════════════════════════════════════════════════════════════
// LEGACY API (kept verbatim — do not change signatures, many callers)
// ═════════════════════════════════════════════════════════════════════

export function buildCacheKey(params: {
  specialty?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  objective?: string;
  extra?: string;
}): string {
  const parts = [
    params.specialty || "_",
    params.topic || "_",
    params.subtopic || "_",
    params.difficulty || "_",
    params.objective || "_",
    params.extra || "_",
  ];
  return parts.map(p => p.toLowerCase().trim().replace(/\s+/g, "-")).join("::");
}

export async function getCachedContent(cacheKey: string, contentType: string): Promise<any | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("ai_content_cache")
      .select("id, content_json, hit_count")
      .eq("cache_key", cacheKey)
      .eq("content_type", contentType)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    sb.from("ai_content_cache").update({ hit_count: (data as any).hit_count + 1 || 1 }).eq("id", data.id).then(() => {});
    return data.content_json;
  } catch {
    return null;
  }
}

export async function setCachedContent(
  cacheKey: string,
  contentType: string,
  contentJson: any,
  modelUsed?: string,
  ttlDays = 30,
): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const expiresAt = new Date(Date.now() + ttlDays * 86400000).toISOString();
    await sb.from("ai_content_cache").upsert(
      {
        cache_key: cacheKey,
        content_type: contentType,
        content_json: contentJson,
        model_used: modelUsed || "unknown",
        expires_at: expiresAt,
        hit_count: 0,
        scope: "global",
        user_id: null,
      },
      { onConflict: "cache_key,content_type" },
    );
  } catch (e) {
    console.warn("Cache write failed (non-critical):", e);
  }
}

/**
 * Legacy logAiUsage — now delegates to v2 logAIUsage so the schema mismatch
 * bug (silently failing inserts) is fixed for ALL existing callers without
 * forcing a code change.
 */
export async function logAiUsage(params: {
  userId: string;
  functionName: string;
  modelUsed: string;
  success: boolean;
  responseTimeMs: number;
  tokensUsed?: number;
  cacheHit?: boolean;
  modelTier?: string;
  errorMessage?: string;
}): Promise<void> {
  await logAIUsage({
    userId: params.userId,
    module: params.functionName,
    functionName: params.functionName,
    model: params.modelUsed,
    cacheStatus: params.cacheHit ? "hit" : (params.success ? "miss" : undefined),
    latencyMs: params.responseTimeMs,
    tokensUsed: params.tokensUsed,
    success: params.success,
    errorMessage: params.errorMessage,
    modelTier: params.modelTier,
  });
}
