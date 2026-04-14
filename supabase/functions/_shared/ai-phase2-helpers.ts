/**
 * Phase 2 AI helpers: cache, usage control, and light AI calls.
 * Reuses existing ai_content_cache table for caching.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export { corsHeaders };

function getAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ── Auth helper ──
export async function extractUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
  );
  const { data } = await sb.auth.getUser(auth);
  return data?.user?.id || null;
}

// ── Cache (reuses ai_content_cache) ──
function hashInput(type: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k] ?? "").toLowerCase().trim()}`)
    .join("::");
  return `phase2::${type}::${sorted}`;
}

export async function getCache(
  type: string,
  params: Record<string, unknown>,
): Promise<{ hit: true; data: any } | { hit: false; key: string }> {
  const key = hashInput(type, params);
  try {
    const sb = getAdmin();
    const { data } = await sb
      .from("ai_content_cache")
      .select("content_json")
      .eq("cache_key", key)
      .eq("content_type", type)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) return { hit: true, data: data.content_json };
  } catch {
    /* miss */
  }
  return { hit: false, key };
}

export async function setCache(
  key: string,
  type: string,
  json: any,
  ttlDays = 30,
) {
  try {
    const sb = getAdmin();
    await sb.from("ai_content_cache").upsert(
      {
        cache_key: key,
        content_type: type,
        content_json: json,
        model_used: "gemini-2.5-flash-lite",
        expires_at: new Date(Date.now() + ttlDays * 86_400_000).toISOString(),
        hit_count: 0,
      },
      { onConflict: "cache_key,content_type" },
    );
  } catch {
    /* non-critical */
  }
}

// ── Usage control ──
const LIMITS: Record<string, number> = {
  free: 30,
  pro: 150,
  premium: 500,
  enterprise: 2000,
};

export async function checkAndIncrementUsage(
  userId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const sb = getAdmin();
  const period = new Date().toISOString().slice(0, 7) + "-01"; // YYYY-MM-01

  // Upsert to ensure row exists
  const { data: row } = await sb
    .from("ai_usage_control")
    .upsert(
      { user_id: userId, period_start: period },
      { onConflict: "user_id,period_start", ignoreDuplicates: true },
    )
    .select("ai_calls_used, ai_calls_limit, plan_type")
    .maybeSingle();

  // If upsert didn't return, fetch
  let usage = row;
  if (!usage) {
    const { data } = await sb
      .from("ai_usage_control")
      .select("ai_calls_used, ai_calls_limit, plan_type")
      .eq("user_id", userId)
      .eq("period_start", period)
      .maybeSingle();
    usage = data;
  }

  const limit = usage?.ai_calls_limit ?? LIMITS[usage?.plan_type ?? "free"] ?? 30;
  const used = usage?.ai_calls_used ?? 0;

  if (used >= limit) {
    return { allowed: false, remaining: 0 };
  }

  // Increment
  await sb
    .from("ai_usage_control")
    .update({ ai_calls_used: used + 1 })
    .eq("user_id", userId)
    .eq("period_start", period);

  return { allowed: true, remaining: limit - used - 1 };
}

// ── Light AI call ──
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

export async function callLightAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(`AI call failed (${res.status}):`, t.slice(0, 200));
    if (res.status === 429) throw new Error("AI_RATE_LIMITED");
    if (res.status === 402) throw new Error("AI_CREDITS_EXHAUSTED");
    throw new Error("AI_SERVICE_UNAVAILABLE");
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "";
}

// ── JSON response helpers ──
export function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Fallback message ──
export function fallbackMessage(theme: string): string {
  return `Revise o tema "${theme}" com base no seu material de estudo. Você pode tentar novamente mais tarde quando seu limite for renovado.`;
}
