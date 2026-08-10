/**
 * NVIDIA Anthropic-Compatible Shadow Layer — ENAZIZI
 * ------------------------------------------------------------------
 * OPT-IN / SHADOW — NÃO ATIVO EM NENHUM MÓDULO DE PRODUÇÃO.
 *
 * Objetivo: aceitar payloads no CONTRATO ANTHROPIC (system top-level,
 * messages, max_tokens) e executá-los em modelos NVIDIA NIM.
 *
 * IMPORTANTE (validado em runtime em 2026-08-10):
 *   O endpoint HOSPEDADO `https://integrate.api.nvidia.com/v1` NÃO expõe
 *   POST /v1/messages (404 em todas as variantes testadas). O endpoint
 *   Anthropic-compatible existe apenas em NIM self-hosted.
 *   => Este cliente faz PROBE do endpoint nativo e, quando indisponível,
 *      usa um ADAPTER interno Anthropic -> OpenAI /chat/completions.
 *      Isto NÃO é Claude: o modelo é um modelo NVIDIA (ex.: Llama 3.3 70B)
 *      atrás de um contrato Anthropic-compatible.
 *
 * REGRAS:
 * - A chave NUNCA é logada, retornada, nem exposta ao frontend.
 * - Circuit breaker e telemetria reaproveitados do nvidia-provider.
 */

import {
  getNvidiaApiKey,
  getNvidiaBaseUrl,
  isNvidiaCircuitOpen,
  NVIDIA_DEFAULT_TIMEOUT_MS,
  NvidiaProviderError,
  recordNvidiaFailure,
  recordNvidiaSuccess,
} from "./nvidia-provider.ts";

/** Feature metadata — desabilitada por padrão. */
export const NVIDIA_ANTHROPIC_SHADOW_META = {
  key: "nvidia_anthropic_shadow",
  enabled: false,
  stage: "shadow" as const,
  nativeMessagesSupported: false, // hosted endpoint: 404 (medido)
  transport: "adapter" as const, // "native" | "adapter"
};

export type AnthropicTextBlock = { type: "text"; text: string };

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<AnthropicTextBlock | { type: string; [k: string]: unknown }>;
}

export interface AnthropicRequest {
  model: string;
  system?: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  stream?: false;
}

export interface AnthropicShapedResponse {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: AnthropicTextBlock[];
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | null;
  stop_sequence: null;
  usage: { input_tokens: number; output_tokens: number };
}

export interface NvidiaAnthropicResult {
  /** Contrato comum ENAZIZI */
  content: string;
  provider: "nvidia";
  transport: "native" | "adapter";
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  /** Forma Anthropic preservada para compatibilidade de clientes */
  anthropic: AnthropicShapedResponse;
  raw: unknown;
}

/* ------------------------------------------------------------------ */
/* Helpers de contrato                                                 */
/* ------------------------------------------------------------------ */

export function flattenAnthropicContent(content: AnthropicMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => (b && typeof b === "object" && "text" in b ? String((b as AnthropicTextBlock).text ?? "") : ""))
    .filter(Boolean)
    .join("\n");
}

/** Anthropic -> OpenAI chat/completions */
export function anthropicToOpenAIBody(req: AnthropicRequest) {
  const messages: Array<{ role: string; content: string }> = [];
  if (req.system && req.system.trim()) messages.push({ role: "system", content: req.system });
  for (const m of req.messages ?? []) {
    messages.push({ role: m.role, content: flattenAnthropicContent(m.content) });
  }
  const body: Record<string, unknown> = {
    model: req.model,
    messages,
    max_tokens: req.max_tokens,
    stream: false,
  };
  if (typeof req.temperature === "number") body.temperature = req.temperature;
  return body;
}

function mapFinishReason(reason: string | null | undefined): AnthropicShapedResponse["stop_reason"] {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    case "stop_sequence":
      return "stop_sequence";
    default:
      return reason ? "end_turn" : null;
  }
}

/** OpenAI chat/completions -> forma Anthropic */
export function openAIToAnthropicResponse(parsed: any, fallbackModel: string): AnthropicShapedResponse {
  const msg = parsed?.choices?.[0]?.message ?? {};
  const text: string = msg.content || msg.reasoning_content || msg.reasoning || "";
  return {
    id: parsed?.id ? String(parsed.id) : `msg_${crypto.randomUUID()}`,
    type: "message",
    role: "assistant",
    model: parsed?.model ?? fallbackModel,
    content: text ? [{ type: "text", text }] : [],
    stop_reason: mapFinishReason(parsed?.choices?.[0]?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: parsed?.usage?.prompt_tokens ?? 0,
      output_tokens: parsed?.usage?.completion_tokens ?? 0,
    },
  };
}

/** Normaliza uma resposta já nativa Anthropic para o contrato comum. */
export function normalizeNativeAnthropic(parsed: any, fallbackModel: string): AnthropicShapedResponse {
  const blocks: AnthropicTextBlock[] = Array.isArray(parsed?.content)
    ? parsed.content
        .filter((b: any) => b?.type === "text" && typeof b?.text === "string")
        .map((b: any) => ({ type: "text" as const, text: b.text }))
    : [];
  return {
    id: parsed?.id ?? `msg_${crypto.randomUUID()}`,
    type: "message",
    role: "assistant",
    model: parsed?.model ?? fallbackModel,
    content: blocks,
    stop_reason: parsed?.stop_reason ?? null,
    stop_sequence: parsed?.stop_sequence ?? null,
    usage: {
      input_tokens: parsed?.usage?.input_tokens ?? 0,
      output_tokens: parsed?.usage?.output_tokens ?? 0,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Probe do endpoint nativo /v1/messages                               */
/* ------------------------------------------------------------------ */

export type MessagesSupport = "working" | "not_supported" | "broken";

export async function probeAnthropicMessagesEndpoint(opts: {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  timeoutMs?: number;
} ): Promise<{ support: MessagesSupport; httpStatus: number | null; latencyMs: number; detail?: string }> {
  const apiKey = getNvidiaApiKey(opts.apiKey);
  if (!apiKey) return { support: "broken", httpStatus: null, latencyMs: 0, detail: "not_configured" };

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`${getNvidiaBaseUrl(opts.baseUrl)}/messages`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: 16,
        messages: [{ role: "user", content: "ok" }],
      }),
    });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    if (res.ok) return { support: "working", httpStatus: res.status, latencyMs };
    if (res.status === 404 || res.status === 405 || res.status === 501) {
      return { support: "not_supported", httpStatus: res.status, latencyMs, detail: text.slice(0, 160) };
    }
    return { support: "broken", httpStatus: res.status, latencyMs, detail: text.slice(0, 160) };
  } catch (err) {
    return {
      support: "broken",
      httpStatus: null,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.name : "network_error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Chamada principal (contrato Anthropic)                              */
/* ------------------------------------------------------------------ */

export interface NvidiaAnthropicCallOptions extends AnthropicRequest {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** "auto" tenta nativo e cai para adapter; "adapter" força tradução. */
  transport?: "auto" | "native" | "adapter";
}

export async function callNvidiaAnthropic(
  options: NvidiaAnthropicCallOptions,
): Promise<NvidiaAnthropicResult> {
  const model = options.model;
  const apiKey = getNvidiaApiKey(options.apiKey);
  if (!apiKey) {
    throw new NvidiaProviderError("NVIDIA_API_KEY ausente", "not_configured", null, 0, model);
  }
  if (isNvidiaCircuitOpen(model)) {
    throw new NvidiaProviderError("Circuit breaker aberto", "circuit_open", null, 0, model);
  }

  const timeoutMs = options.timeoutMs ?? NVIDIA_DEFAULT_TIMEOUT_MS;
  const baseUrl = getNvidiaBaseUrl(options.baseUrl);
  const wanted = options.transport ?? "auto";

  // 1) Tentativa nativa /messages (NIM self-host)
  if (wanted === "native" || wanted === "auto") {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: options.system,
          messages: options.messages,
          max_tokens: options.max_tokens,
          ...(typeof options.temperature === "number" ? { temperature: options.temperature } : {}),
          stream: false,
        }),
      });
      const latencyMs = Date.now() - started;
      const text = await res.text();
      if (res.ok) {
        const parsed = JSON.parse(text);
        const anthropic = normalizeNativeAnthropic(parsed, model);
        recordNvidiaSuccess(model);
        return {
          content: anthropic.content.map((b) => b.text).join("\n"),
          provider: "nvidia",
          transport: "native",
          model: anthropic.model,
          latencyMs,
          usage: { inputTokens: anthropic.usage.input_tokens, outputTokens: anthropic.usage.output_tokens },
          anthropic,
          raw: parsed,
        };
      }
      const unsupported = res.status === 404 || res.status === 405 || res.status === 501;
      if (!unsupported || wanted === "native") {
        recordNvidiaFailure(model);
        throw new NvidiaProviderError(text.slice(0, 200), `HTTP_${res.status}`, res.status, latencyMs, model);
      }
      // unsupported + auto => segue para adapter (sem contar falha do breaker)
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof NvidiaProviderError) throw err;
      if (wanted === "native") {
        recordNvidiaFailure(model);
        throw new NvidiaProviderError("network_error", "NETWORK", null, Date.now() - started, model);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  // 2) Adapter Anthropic -> OpenAI /chat/completions
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(anthropicToOpenAIBody(options)),
    });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    if (!res.ok) {
      recordNvidiaFailure(model);
      let code = `HTTP_${res.status}`;
      let msg = text.slice(0, 240);
      try {
        const p = JSON.parse(text);
        code = p?.error?.code || p?.error?.type || code;
        msg = p?.error?.message || p?.detail || msg;
      } catch { /* texto cru */ }
      throw new NvidiaProviderError(String(msg), String(code), res.status, latencyMs, model);
    }
    const parsed = JSON.parse(text);
    const anthropic = openAIToAnthropicResponse(parsed, model);
    recordNvidiaSuccess(model);
    return {
      content: anthropic.content.map((b) => b.text).join("\n"),
      provider: "nvidia",
      transport: "adapter",
      model: anthropic.model,
      latencyMs,
      usage: { inputTokens: anthropic.usage.input_tokens, outputTokens: anthropic.usage.output_tokens },
      anthropic,
      raw: parsed,
    };
  } catch (err) {
    if (err instanceof NvidiaProviderError) throw err;
    const latencyMs = Date.now() - started;
    recordNvidiaFailure(model);
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new NvidiaProviderError(
      aborted ? "timeout" : "network_error",
      aborted ? "TIMEOUT" : "NETWORK",
      null,
      latencyMs,
      model,
    );
  } finally {
    clearTimeout(timer);
  }
}
