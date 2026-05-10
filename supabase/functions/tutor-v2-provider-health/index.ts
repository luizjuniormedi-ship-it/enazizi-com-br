import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const HEALTH_MODEL = "google/gemini-3-flash-preview";
const TIMEOUT_MS = 12_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getGatewayKey() {
  return Deno.env.get("LOVABLE_API_KEY") ||
    Deno.env.get("AI_GATEWAY_API_KEY") ||
    Deno.env.get("LOVABLE_AI_GATEWAY_KEY") ||
    "";
}

function getEnvPresence() {
  return {
    LOVABLE_API_KEY: Boolean(Deno.env.get("LOVABLE_API_KEY")),
    OPENAI_API_KEY: Boolean(Deno.env.get("OPENAI_API_KEY")),
    GEMINI_API_KEY: Boolean(Deno.env.get("GEMINI_API_KEY")),
    AI_GATEWAY_API_KEY: Boolean(Deno.env.get("AI_GATEWAY_API_KEY")),
    LOVABLE_AI_GATEWAY_KEY: Boolean(Deno.env.get("LOVABLE_AI_GATEWAY_KEY")),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function classifyStatus(status?: number) {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 402) return "quota_error";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status && status >= 500) return "provider_unavailable";
  return "unknown_error";
}

serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const key = getGatewayKey();
  const env = getEnvPresence();

  if (!key) {
    return new Response(JSON.stringify({
      ok: false,
      status: "not_configured",
      provider: "lovable-ai",
      model: HEALTH_MODEL,
      latency_ms: 0,
      env,
      error: "AI_PROVIDER_NOT_CONFIGURED",
      message: "O provedor de IA do Tutor não está configurado.",
      requestId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HEALTH_MODEL,
        messages: [
          { role: "system", content: "Responda apenas: ok" },
          { role: "user", content: "health" },
        ],
        max_tokens: 8,
      }),
    }, TIMEOUT_MS);

    const latency = Date.now() - startedAt;
    const body = await response.text();

    if (!response.ok) {
      console.error("[TUTOR_V2_PROVIDER_HEALTH_ERROR]", {
        provider: "lovable-ai",
        model: HEALTH_MODEL,
        status: response.status,
        code: classifyStatus(response.status),
        message: body.slice(0, 300),
        requestId,
      });
      return new Response(JSON.stringify({
        ok: false,
        status: classifyStatus(response.status),
        provider: "lovable-ai",
        model: HEALTH_MODEL,
        latency_ms: latency,
        env,
        requestId,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      status: "healthy",
      provider: "lovable-ai",
      model: HEALTH_MODEL,
      latency_ms: latency,
      env,
      requestId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const latency = Date.now() - startedAt;
    const isTimeout = err instanceof DOMException && err.name === "AbortError";
    console.error("[TUTOR_V2_PROVIDER_HEALTH_ERROR]", {
      provider: "lovable-ai",
      model: HEALTH_MODEL,
      status: undefined,
      code: isTimeout ? "timeout" : "network_error",
      message: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return new Response(JSON.stringify({
      ok: false,
      status: isTimeout ? "timeout" : "network_error",
      provider: "lovable-ai",
      model: HEALTH_MODEL,
      latency_ms: latency,
      env,
      requestId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
