/**
 * Global AI content cache utilities.
 * Provides cache lookup, storage, and key generation for all AI modules.
 */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Build a deterministic cache key from parameters */
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

/** Look up cached content. Returns null if miss. */
export async function getCachedContent(
  cacheKey: string,
  contentType: string,
): Promise<any | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("ai_content_cache")
      .select("id, content_json")
      .eq("cache_key", cacheKey)
      .eq("content_type", contentType)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;

    // Increment hit count asynchronously (fire-and-forget)
    sb.from("ai_content_cache")
      .update({ hit_count: (data as any).hit_count + 1 || 1 })
      .eq("id", data.id)
      .then(() => {});

    return data.content_json;
  } catch {
    return null;
  }
}

/** Store content in cache */
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
      },
      { onConflict: "cache_key,content_type" }
    );
  } catch (e) {
    console.warn("Cache write failed (non-critical):", e);
  }
}

/** Log AI usage with cost estimation */
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
  try {
    const sb = getSupabaseAdmin();
    // Cost estimation per 1K tokens (approximate)
    const costPer1k: Record<string, number> = {
      "google/gemini-2.5-flash-lite": 0.0001,
      "google/gemini-3-flash-preview": 0.0003,
      "google/gemini-2.5-flash": 0.0003,
      "google/gemini-2.5-pro": 0.005,
      "gpt-4o-mini": 0.0003,
      "gpt-4o": 0.005,
    };
    const rate = costPer1k[params.modelUsed] || 0.001;
    const costEstimate = ((params.tokensUsed || 0) / 1000) * rate;

    // user_id is uuid — use null for system/anonymous callers
    const isValidUuid = params.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.userId);

    await sb.from("ai_usage_logs").insert({
      user_id: isValidUuid ? params.userId : null,
      function_name: params.functionName,
      model_used: params.modelUsed,
      success: params.success,
      response_time_ms: params.responseTimeMs,
      tokens_used: params.tokensUsed,
      cache_hit: params.cacheHit || false,
      model_tier: params.modelTier || "standard",
      cost_estimate: costEstimate,
      error_message: params.errorMessage,
      actor_type: isValidUuid ? "user" : "system",
      actor_key: isValidUuid ? null : (params.userId || "system"),
    });
  } catch (e) {
    console.warn("[logAiUsage] insert failed:", e);
  }
}
