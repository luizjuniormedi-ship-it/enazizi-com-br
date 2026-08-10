// ENAZIZI EU-AI — Proxy Anthropic-nativo para o Claude Gateway (IA principal)
//
// Endpoint upstream: ANTHROPIC_BASE_URL/v1/messages (formato oficial Anthropic).
// Autenticação: x-api-key = ANTHROPIC_API_KEY.
//
// Cadeia: Claude Gateway → Railway → Lovable AI Gateway.
// A cadeia só AVANÇA quando o erro é classificado como retryable:
//   - 401/403 (auth)
//   - 408/425/429 (rate/timeout)
//   - 5xx (upstream)
//   - network error / timeout de fetch
//   - 400 SOMENTE se o corpo confirmar "key expired" / "key acabou" / "key expirou"
// Para outros 400 (payload inválido, modelo inválido não recuperável, etc.)
// devolvemos 502 com detalhe estruturado — o app precisa corrigir a chamada, não trocar de provedor.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_BASE_URL =
  Deno.env.get("ANTHROPIC_BASE_URL") ||
  Deno.env.get("CLAUDE_GATEWAY_BASE_URL") ||
  "";
const CLAUDE_API_KEY =
  Deno.env.get("ANTHROPIC_API_KEY") ||
  Deno.env.get("CLAUDE_GATEWAY_API_KEY") ||
  "";
const EU_AI_URL = Deno.env.get("EU_API_URL") || "https://enazizi-com-br-production.up.railway.app";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_DEFAULT_MODEL = Deno.env.get("LOVABLE_DEFAULT_MODEL") || "google/gemini-2.0-flash";

// P0-2: MODEL REGISTRY - Centralizando modelos válidos para o gateway
const AI_MODELS = {
  claude: {
    primary: Deno.env.get("CLAUDE_PRIMARY_MODEL") || "claude-3-5-sonnet-20241022",
    fallback: Deno.env.get("CLAUDE_FALLBACK_MODEL") || "claude-3-5-haiku-20241022"
  },
  openai: {
    primary: "gpt-4o",
    fallback: "gpt-4o-mini"
  }
};

const DEFAULT_MODEL = AI_MODELS.claude.primary;
const FALLBACK_MODEL = AI_MODELS.claude.fallback;

// P0-2: Circuit Breaker State para Auto-Disable
let claudeFailureCount = 0;
let claudeDisabledUntil = 0;
const CLAUDE_MAX_FAILURES = 3;
const CLAUDE_COOLDOWN_MS = 300000; // 5 minutos



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface InPayload {
  message?: string;
  prompt?: string;
  text?: string;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  topic?: string;
  especialidade?: string;
  subject?: string;
  system?: string;
  model?: string;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

type AttemptResult = {
  ok: boolean;
  text?: string;
  provider?: string;
  model?: string;
  status: number;
  requestId?: string;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  retryable: boolean;
};

// ---------- Error classifier ----------
const KEY_EXPIRED_RX = /(key|chave)\s*(expired|acabou|expirou|invalid|revoked|renov(ar|e|ada?))/i;

function classify(status: number, bodyText: string): { retryable: boolean; code: string } {
  if (status === 0) return { retryable: true, code: "network_error" };
  if (status === 408 || status === 425 || status === 429) return { retryable: true, code: `http_${status}` };
  if (status === 401 || status === 403) return { retryable: true, code: `auth_${status}` };
  if (status >= 500) return { retryable: true, code: `upstream_${status}` };
  if (status === 400 && KEY_EXPIRED_RX.test(bodyText)) return { retryable: true, code: "key_expired" };
  if (status === 400) return { retryable: false, code: "bad_request" };
  return { retryable: false, code: `http_${status}` };
}

function structuredLog(event: string, data: Record<string, unknown>) {
  // Nunca logamos prompt/mensagem — só metadados.
  console.log(`[EU-AI] ${event} ${JSON.stringify(data)}`);
}

function extractUserContent(body: InPayload): { messages: Array<{ role: "user" | "assistant"; content: string }>; system?: string } {
  const anthropicMsgs: Array<{ role: "user" | "assistant"; content: string }> = [];
  let system = body.system;

  if (Array.isArray(body.messages) && body.messages.length > 0) {
    for (const m of body.messages) {
      if (!m?.content) continue;
      if (m.role === "system") {
        system = (system ? system + "\n\n" : "") + m.content;
      } else if (m.role === "user" || m.role === "assistant") {
        anthropicMsgs.push({ role: m.role, content: m.content });
      }
    }
  }

  if (anthropicMsgs.length === 0) {
    const one = body.message || body.prompt || body.text;
    if (one) anthropicMsgs.push({ role: "user", content: String(one) });
  }

  if (anthropicMsgs.length === 0) {
    anthropicMsgs.push({ role: "user", content: "Olá" });
  }

  return { messages: anthropicMsgs, system };
}

async function callClaudeGateway(body: InPayload, modelOverride?: string): Promise<AttemptResult> {
  const t0 = Date.now();
  if (!CLAUDE_BASE_URL || !CLAUDE_API_KEY) {
    return {
      ok: false, status: 0, latencyMs: 0, retryable: true,
      errorCode: "not_configured", errorMessage: "ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY ausentes",
    };
  }

  const { messages, system } = extractUserContent(body);
  const model = modelOverride || body.model || DEFAULT_MODEL;

  const payload: Record<string, unknown> = { model, max_tokens: body.max_tokens ?? 2000, messages };
  if (system) payload.system = system;

  try {
    const resp = await fetch(`${CLAUDE_BASE_URL.replace(/\/+$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const requestId = resp.headers.get("x-request-id") || resp.headers.get("request-id") || undefined;
    const raw = await resp.text();
    const latencyMs = Date.now() - t0;
    const data = (() => { try { return JSON.parse(raw); } catch { return {}; } })();

    if (!resp.ok) {
      const cls = classify(resp.status, raw);
      structuredLog("claude.error", {
        provider: "claude-gateway", model, status: resp.status, requestId,
        latencyMs, errorCode: cls.code, retryable: cls.retryable,
        bodySnippet: raw.slice(0, 200),
      });
      return {
        ok: false, status: resp.status, latencyMs, requestId, retryable: cls.retryable,
        errorCode: cls.code, errorMessage: data?.error?.message || raw.slice(0, 200),
      };
    }

    const text = Array.isArray(data?.content)
      ? data.content.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n").trim()
      : (typeof data?.content === "string" ? data.content : "");

    if (!text) {
      structuredLog("claude.empty", { provider: "claude-gateway", model, status: 200, requestId, latencyMs });
      return {
        ok: false, status: 200, latencyMs, requestId, retryable: true,
        errorCode: "empty_response", errorMessage: "resposta vazia do gateway",
      };
    }

    structuredLog("claude.ok", { provider: "claude-gateway", model: data?.model || model, status: 200, requestId, latencyMs });
    return { ok: true, text, provider: "claude-gateway", model: data?.model || model, status: 200, requestId, latencyMs, retryable: false };
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    structuredLog("claude.network_error", { provider: "claude-gateway", model, latencyMs, errorMessage: err?.message });
    return { ok: false, status: 0, latencyMs, retryable: true, errorCode: "network_error", errorMessage: err?.message };
  }
}

async function callRailwayFallback(body: InPayload): Promise<AttemptResult> {
  const t0 = Date.now();
  try {
    const message =
      body.message || body.prompt || body.text ||
      (Array.isArray(body.messages) ? [...body.messages].reverse().find((m) => m?.role === "user")?.content : "") ||
      "Olá";
    const topic = body.topic || body.especialidade || body.subject || "Medicina";

    const resp = await fetch(`${EU_API_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, topic, stream: false }),
    });
    const requestId = resp.headers.get("x-request-id") || undefined;
    const raw = await resp.text();
    const latencyMs = Date.now() - t0;
    const data = (() => { try { return JSON.parse(raw); } catch { return {}; } })();

    if (!resp.ok || data?.success === false) {
      // Se HTTP=200 mas success:false, é falha lógica do Railway → SEMPRE retryable
      // (classify(200,...) cairia no default retryable:false e travaria a cadeia).
      const cls = resp.ok
        ? { retryable: true, code: "railway_success_false" }
        : classify(resp.status, raw);
      structuredLog("railway.error", { provider: "railway", status: resp.status, requestId, latencyMs, errorCode: cls.code });
      return { ok: false, status: resp.status, latencyMs, requestId, retryable: cls.retryable, errorCode: cls.code };
    }
    const text = String(data.message || data.content || "").trim();
    if (!text || /todas as ias falharam/i.test(text)) {
      structuredLog("railway.empty_or_marker", { provider: "railway", status: resp.status, requestId, latencyMs });
      return { ok: false, status: resp.status, latencyMs, requestId, retryable: true, errorCode: "empty_or_marker" };
    }
    structuredLog("railway.ok", { provider: data.provider || "railway", status: 200, requestId, latencyMs });
    return { ok: true, text, provider: data.provider || "railway", status: 200, requestId, latencyMs, retryable: false };
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    structuredLog("railway.network_error", { provider: "railway", latencyMs, errorMessage: err?.message });
    return { ok: false, status: 0, latencyMs, retryable: true, errorCode: "network_error", errorMessage: err?.message };
  }
}

async function callLovableGateway(body: InPayload): Promise<AttemptResult> {
  const t0 = Date.now();
  if (!LOVABLE_API_KEY) {
    return { ok: false, status: 0, latencyMs: 0, retryable: false, errorCode: "not_configured", errorMessage: "LOVABLE_API_KEY ausente" };
  }
  const { messages, system } = extractUserContent(body);
  const openaiMessages: Array<{ role: string; content: string }> = [];
  if (system) openaiMessages.push({ role: "system", content: system });
  for (const m of messages) openaiMessages.push({ role: m.role, content: m.content });

  const model = LOVABLE_DEFAULT_MODEL;
  try {
    const resp = await fetch(LOVABLE_GATEWAY_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model, messages: openaiMessages, max_tokens: body.max_tokens ?? 2000 }),
    });
    const requestId = resp.headers.get("x-lovable-aig-log-id") || resp.headers.get("x-request-id") || undefined;
    const raw = await resp.text();
    const latencyMs = Date.now() - t0;
    const data = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
    if (!resp.ok) {
      const cls = classify(resp.status, raw);
      structuredLog("lovable.error", { provider: "lovable-ai", model, status: resp.status, requestId, latencyMs, errorCode: cls.code, bodySnippet: raw.slice(0, 200) });
      return { ok: false, status: resp.status, latencyMs, requestId, retryable: cls.retryable, errorCode: cls.code, errorMessage: data?.error?.message || raw.slice(0, 200) };
    }
    const text = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      structuredLog("lovable.empty", { provider: "lovable-ai", model, status: 200, requestId, latencyMs });
      return { ok: false, status: 200, latencyMs, requestId, retryable: false, errorCode: "empty_response" };
    }
    structuredLog("lovable.ok", { provider: "lovable-ai", model: data?.model || model, status: 200, requestId, latencyMs });
    return { ok: true, text, provider: "lovable-ai", model: data?.model || model, status: 200, requestId, latencyMs, retryable: false };
  } catch (err: any) {
    const latencyMs = Date.now() - t0;
    structuredLog("lovable.network_error", { provider: "lovable-ai", latencyMs, errorMessage: err?.message });
    return { ok: false, status: 0, latencyMs, retryable: true, errorCode: "network_error", errorMessage: err?.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  
  // P0-2: Provider Healthcheck
  if (url.pathname.endsWith("/provider-health")) {
    return new Response(JSON.stringify({
      claude: Date.now() > claudeDisabledUntil ? "ok" : "disabled",
      openai: "ok",
      google: "ok",
      timestamp: new Date().toISOString()
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }

  const reqStart = Date.now();
  try {
    const body = (await req.json().catch(() => ({}))) as InPayload;
    structuredLog("request.in", { 
      hasMessages: Array.isArray(body.messages), 
      hasMessage: !!(body.message || body.prompt || body.text),
      claudeStatus: Date.now() > claudeDisabledUntil ? "active" : "disabled"
    });

    // 1) Claude Gateway (com Circuit Breaker)
    let result: AttemptResult = { ok: false, status: 0, latencyMs: 0, retryable: true, errorCode: "circuit_open" };
    
    if (Date.now() > claudeDisabledUntil) {
      result = await callClaudeGateway(body);

      // P0-2: Auto-Disable se Claude retornar invalid model
      if (!result.ok && result.status === 400 && /model(o)?/i.test(result.errorMessage || "")) {
        structuredLog("claude.model_retry", { fallbackModel: FALLBACK_MODEL });
        result = await callClaudeGateway(body, FALLBACK_MODEL);
        
        if (!result.ok && result.status === 400 && /model(o)?/i.test(result.errorMessage || "")) {
          claudeFailureCount++;
          if (claudeFailureCount >= CLAUDE_MAX_FAILURES) {
            claudeDisabledUntil = Date.now() + CLAUDE_COOLDOWN_MS;
            structuredLog("claude.circuit_open", { reason: "repeated_invalid_model", disabledUntil: new Date(claudeDisabledUntil).toISOString() });
          }
        }
      } else if (result.ok) {
        claudeFailureCount = 0; // Reset no sucesso
      }
    }


    if (result.ok && result.text) {
      return new Response(JSON.stringify({
        content: result.text, response: result.text, message: result.text,
        provider: result.provider, model: result.model, source: "claude-gateway",
        requestId: result.requestId, latencyMs: result.latencyMs,
        success: true, timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Claude falhou e NÃO é retryable → devolve erro de integração (502) sem tentar fallback.
    if (!result.retryable) {
      structuredLog("chain.abort_non_retryable", {
        provider: "claude-gateway", status: result.status, errorCode: result.errorCode,
        requestId: result.requestId, totalMs: Date.now() - reqStart,
      });
      return new Response(JSON.stringify({
        success: false, source: "claude-gateway", provider: "claude-gateway",
        status: result.status, errorCode: result.errorCode,
        error: result.errorMessage || "erro de integração no gateway Claude — corrigir payload/modelo antes de reenviar",
        requestId: result.requestId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 });
    }

    // 2) Fallback Railway (só se Claude retornou erro retryable)
    structuredLog("chain.next", { from: "claude-gateway", to: "railway", reason: result.errorCode });
    const rail = await callRailwayFallback(body);
    if (rail.ok && rail.text) {
      return new Response(JSON.stringify({
        content: rail.text, response: rail.text, message: rail.text,
        provider: rail.provider, source: "eu-railway",
        requestId: rail.requestId, latencyMs: rail.latencyMs,
        success: true, timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // 3) Fallback Lovable AI (só se Railway também falhou de forma retryable ou vazio)
    structuredLog("chain.next", { from: "railway", to: "lovable-ai", reason: rail.errorCode });
    const lov = await callLovableGateway(body);
    if (lov.ok && lov.text) {
      return new Response(JSON.stringify({
        content: lov.text, response: lov.text, message: lov.text,
        provider: lov.provider, model: lov.model, source: "lovable-ai",
        requestId: lov.requestId, latencyMs: lov.latencyMs,
        success: true, timestamp: new Date().toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    // Todas falharam
    structuredLog("chain.all_failed", {
      claude: { status: result.status, code: result.errorCode },
      railway: { status: rail.status, code: rail.errorCode },
      lovable: { status: lov.status, code: lov.errorCode },
      totalMs: Date.now() - reqStart,
    });
    return new Response(JSON.stringify({
      success: false, source: "eu-ai", provider: "none",
      error: lov.errorMessage || rail.errorCode || result.errorMessage || "Gateway indisponível",
      chain: {
        claude: { status: result.status, code: result.errorCode, requestId: result.requestId },
        railway: { status: rail.status, code: rail.errorCode, requestId: rail.requestId },
        lovable: { status: lov.status, code: lov.errorCode, requestId: lov.requestId },
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 });
  } catch (error: any) {
    structuredLog("fatal", { errorMessage: error?.message });
    return new Response(JSON.stringify({ success: false, error: error?.message || "erro desconhecido" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
