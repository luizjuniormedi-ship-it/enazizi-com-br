// AI Provider Health — pings each enabled model on the registry with a tiny
// request and upserts the result into ai_provider_health. Designed to run
// every 5 minutes via pg_cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AI_MODELS, getTokenParameterName } from "../_shared/ai-models.ts";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const PING_TIMEOUT_MS = 12_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getKey() {
  return (
    Deno.env.get("LOVABLE_API_KEY") ||
    Deno.env.get("AI_GATEWAY_API_KEY") ||
    Deno.env.get("LOVABLE_AI_GATEWAY_KEY") ||
    ""
  );
}

async function pingModel(model: string, key: string) {
  const start = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
  try {
    const isOpenAI5 = /^openai\/gpt-4o/.test(model);
    const tokenField = isOpenAI5 ? "max_completion_tokens" : "max_tokens";
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: "ping" },
        { role: "user", content: "ok" },
      ],
      [tokenField]: 8,
    };
    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - start;
    const responseText = await res.text();
    if (!res.ok) {
      let code = `HTTP_${res.status}`;
      let msg = responseText.slice(0, 240);
      try {
        const parsed = JSON.parse(responseText);
        code = parsed?.error?.code || parsed?.error?.type || code;
        msg = parsed?.error?.message || msg;
      } catch (_) { /* keep raw */ }
      const status =
        res.status === 402 ? "quota_exhausted" :
        res.status === 429 ? "rate_limited" :
        res.status === 404 ? "model_not_found" :
        res.status >= 500 ? "down" : "degraded";
      return { ok: false, status, latency, code, msg };
    }
    return { ok: true, status: "healthy", latency, code: null, msg: null };
  } catch (err) {
    const latency = Date.now() - start;
    const code = err instanceof DOMException && err.name === "AbortError" ? "TIMEOUT" : "NETWORK";
    return { ok: false, status: "down", latency, code, msg: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const key = getKey();
  if (!key) {
    return new Response(
      JSON.stringify({ error: "AI gateway key missing" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Pega lista distinta de provider+model habilitados
  const { data: registry, error: regErr } = await supabase
    .from("ai_model_registry")
    .select("provider, model")
    .eq("enabled", true);

  if (regErr) {
    return new Response(
      JSON.stringify({ error: regErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const seen = new Set<string>();
  const targets = (registry || []).filter((r) => {
    const k = `${r.provider}::${r.model}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const results: any[] = [];

  for (const t of targets) {
    const ping = await pingModel(t.model, key);

    // Carrega contadores existentes pra acumular
    const { data: existing } = await supabase
      .from("ai_provider_health")
      .select("success_count, error_count")
      .eq("provider", t.provider)
      .eq("model", t.model)
      .maybeSingle();

    const success_count = (existing?.success_count || 0) + (ping.ok ? 1 : 0);
    const error_count = (existing?.error_count || 0) + (ping.ok ? 0 : 1);

    const { error: upErr } = await supabase
      .from("ai_provider_health")
      .upsert(
        {
          provider: t.provider,
          model: t.model,
          status: ping.status,
          latency_ms: ping.latency,
          last_error: ping.ok ? null : ping.msg,
          last_error_code: ping.ok ? null : ping.code,
          success_count,
          error_count,
          checked_at: new Date().toISOString(),
          metadata: { last_check_ok: ping.ok },
        },
        { onConflict: "provider,model" },
      );

    results.push({
      provider: t.provider,
      model: t.model,
      status: ping.status,
      latency_ms: ping.latency,
      ok: ping.ok,
      code: ping.code,
      upsertError: upErr?.message || null,
    });
  }

  return new Response(
    JSON.stringify({ checked: results.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
