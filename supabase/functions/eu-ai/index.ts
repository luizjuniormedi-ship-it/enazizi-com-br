// ENAZIZI EU-AI — Proxy Anthropic-nativo para o Claude Gateway (IA principal)
//
// Endpoint upstream: ANTHROPIC_BASE_URL/v1/messages (formato oficial Anthropic).
// Autenticação: x-api-key = ANTHROPIC_API_KEY.
//
// Formato aceito na entrada (compatível com o cliente existente):
//   { message?: string, prompt?: string, messages?: [{role,content}], topic?, system?, model?, max_tokens?, stream? }
//
// Formato devolvido (compatível com o restante do app):
//   { content, response, message, provider, model, source, success, timestamp }
//
// Fallback: se o gateway falhar, tenta o legado Railway (EU_API_URL). Se ambos falharem,
// devolve 200 com success:false para o app decidir seguir para o Supabase/Lovable AI.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CLAUDE_BASE_URL =
  Deno.env.get("ANTHROPIC_BASE_URL") ||
  Deno.env.get("CLAUDE_GATEWAY_BASE_URL") ||
  "";
const CLAUDE_API_KEY =
  Deno.env.get("ANTHROPIC_API_KEY") ||
  Deno.env.get("CLAUDE_GATEWAY_API_KEY") ||
  "";
const EU_API_URL = Deno.env.get("EU_API_URL") || "https://enazizi-com-br-production.up.railway.app";

// Lovable AI Gateway (fallback universal — chave sempre válida)
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LOVABLE_DEFAULT_MODEL = Deno.env.get("LOVABLE_DEFAULT_MODEL") || "google/gemini-3.6-flash";

// Modelo padrão: Sonnet 4.6 (BALANCED) confirmado no /v1/models do gateway.
const DEFAULT_MODEL = Deno.env.get("CLAUDE_DEFAULT_MODEL") || "claude-sonnet-4.6";
const FALLBACK_MODEL = "claude-sonnet-4"; // 2ª escolha se o padrão for rejeitado

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

async function callClaudeGateway(body: InPayload, modelOverride?: string): Promise<{ ok: boolean; text?: string; provider?: string; model?: string; status: number; raw?: any }> {
  if (!CLAUDE_BASE_URL || !CLAUDE_API_KEY) {
    return { ok: false, status: 0, raw: { error: "Claude gateway não configurado (ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY ausentes)" } };
  }

  const { messages, system } = extractUserContent(body);
  const model = modelOverride || body.model || DEFAULT_MODEL;

  const payload: Record<string, unknown> = {
    model,
    max_tokens: body.max_tokens ?? 2000,
    messages,
  };
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

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.warn(`[EU-AI][Claude] ${resp.status}`, JSON.stringify(data).slice(0, 300));
      return { ok: false, status: resp.status, raw: data };
    }

    // Formato Anthropic: content: [{type:"text", text:"..."}]
    const text = Array.isArray(data?.content)
      ? data.content.filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n").trim()
      : (typeof data?.content === "string" ? data.content : "");

    return { ok: true, text, provider: "claude-gateway", model: data?.model || model, status: 200, raw: data };
  } catch (err: any) {
    console.error("[EU-AI][Claude] fetch error:", err?.message);
    return { ok: false, status: 0, raw: { error: err?.message } };
  }
}

async function callRailwayFallback(body: InPayload): Promise<{ ok: boolean; text?: string; provider?: string; status: number }> {
  try {
    const message =
      body.message ||
      body.prompt ||
      body.text ||
      (Array.isArray(body.messages)
        ? [...body.messages].reverse().find((m) => m?.role === "user")?.content
        : "") ||
      "Olá";
    const topic = body.topic || body.especialidade || body.subject || "Medicina";

    const resp = await fetch(`${EU_API_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, topic, stream: false }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data?.success === false) return { ok: false, status: resp.status };
    return { ok: true, text: data.message || data.content || "", provider: data.provider || "railway", status: 200 };
  } catch (err: any) {
    console.warn("[EU-AI][Railway] fallback error:", err?.message);
    return { ok: false, status: 0 };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as InPayload;
    const shortMsg = (body.message || body.prompt || (body.messages?.at(-1)?.content ?? "")).toString().slice(0, 60);
    console.log(`[EU-AI] ▶ Claude Gateway • "${shortMsg}"`);

    // 1) Claude Gateway (IA principal)
    let result = await callClaudeGateway(body);

    // Se o modelo padrão foi rejeitado (400 modelo inválido), tenta um alternativo.
    if (!result.ok && result.status === 400 && result?.raw?.error?.message?.includes?.("Modelo")) {
      console.warn(`[EU-AI] Modelo padrão rejeitado, retry com ${FALLBACK_MODEL}`);
      result = await callClaudeGateway(body, FALLBACK_MODEL);
    }

    if (result.ok && result.text) {
      return new Response(
        JSON.stringify({
          content: result.text,
          response: result.text,
          message: result.text,
          provider: result.provider,
          model: result.model,
          source: "claude-gateway",
          success: true,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 2) Fallback Railway
    console.warn("[EU-AI] Claude Gateway falhou, tentando Railway…");
    const rail = await callRailwayFallback(body);
    if (rail.ok && rail.text) {
      return new Response(
        JSON.stringify({
          content: rail.text,
          response: rail.text,
          message: rail.text,
          provider: rail.provider,
          source: "eu-railway",
          success: true,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 3) Sem sucesso — devolve success:false para o app decidir fallback (Supabase/Lovable AI)
    return new Response(
      JSON.stringify({
        content: "",
        response: "",
        success: false,
        provider: "none",
        source: "eu-ai",
        error: result?.raw?.error || "Gateway indisponível",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error(`[EU-AI] fatal:`, error?.message);
    return new Response(
      JSON.stringify({
        content: "",
        response: "",
        success: false,
        error: error?.message || "erro desconhecido",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
