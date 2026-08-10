/**
 * NVIDIA Provider — ENAZIZI (OPT-IN / NÃO ATIVO EM PRODUÇÃO)
 * ------------------------------------------------------------------
 * Cliente compartilhado backend para a API OpenAI-compatible da NVIDIA.
 *
 * Contrato:
 *   baseUrl: NVIDIA_BASE_URL || https://integrate.api.nvidia.com/v1
 *   auth:    Authorization: Bearer ${NVIDIA_API_KEY}
 *   rota:    POST /chat/completions   |   GET /models
 *
 * REGRAS:
 * - A chave NUNCA é logada, retornada, nem exposta ao frontend.
 * - Provider fica DESABILITADO enquanto NVIDIA_API_KEY estiver ausente.
 * - Circuit breaker isolado: não afeta OpenAI/Gemini/Claude.
 */

export const NVIDIA_DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const NVIDIA_DEFAULT_TIMEOUT_MS = 30_000;

/** Metadata de capability — fonte única para o futuro AI Router. */
export const NVIDIA_MODEL_REGISTRY = {
  fast: {
    id: "meta/llama-3.1-8b-instruct",
    tier: "FAST" as const,
    vision: false,
    reasoning: false,
  },
  reasoning: {
    id: "meta/llama-3.3-70b-instruct",
    tier: "REASONING" as const,
    vision: false,
    reasoning: true,
  },
} as const;

export const NVIDIA_HEALTHCHECK_CANDIDATES = [
  NVIDIA_MODEL_REGISTRY.fast.id,
  NVIDIA_MODEL_REGISTRY.reasoning.id,
];

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaCallOptions {
  model: string;
  messages: NvidiaMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface NvidiaResult {
  content: string;
  provider: "nvidia";
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  raw: unknown;
}

export class NvidiaProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number | null,
    public readonly latencyMs: number,
    public readonly model: string,
  ) {
    super(message);
    this.name = "NvidiaProviderError";
  }
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

function env(name: string): string | undefined {
  try {
    // deno-lint-ignore no-explicit-any
    return (globalThis as any).Deno?.env?.get?.(name) || undefined;
  } catch {
    return undefined;
  }
}

export function getNvidiaApiKey(explicit?: string): string | null {
  const key = explicit || env("NVIDIA_API_KEY");
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function getNvidiaBaseUrl(explicit?: string): string {
  const raw = explicit || env("NVIDIA_BASE_URL") || NVIDIA_DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/** Provider só é considerado habilitado quando o secret existe. */
export function isNvidiaEnabled(explicitKey?: string): boolean {
  return getNvidiaApiKey(explicitKey) !== null;
}

/* ------------------------------------------------------------------ */
/* Circuit breaker isolado (por provider/model)                        */
/* ------------------------------------------------------------------ */

export const NVIDIA_BREAKER_THRESHOLD = 3;
export const NVIDIA_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

interface BreakerState {
  failures: number;
  openedAt: number | null;
}

const breakerStore = new Map<string, BreakerState>();

function breakerKey(model: string) {
  return `nvidia:${model}`;
}

export function isNvidiaCircuitOpen(model: string, now = Date.now()): boolean {
  const state = breakerStore.get(breakerKey(model));
  if (!state?.openedAt) return false;
  if (now - state.openedAt >= NVIDIA_BREAKER_COOLDOWN_MS) {
    breakerStore.delete(breakerKey(model));
    return false;
  }
  return true;
}

export function recordNvidiaFailure(model: string, now = Date.now()): void {
  const key = breakerKey(model);
  const state = breakerStore.get(key) ?? { failures: 0, openedAt: null };
  state.failures += 1;
  if (state.failures >= NVIDIA_BREAKER_THRESHOLD) state.openedAt = now;
  breakerStore.set(key, state);
}

export function recordNvidiaSuccess(model: string): void {
  breakerStore.delete(breakerKey(model));
}

export function resetNvidiaBreaker(model?: string): void {
  if (model) breakerStore.delete(breakerKey(model));
  else breakerStore.clear();
}

/* ------------------------------------------------------------------ */
/* Catálogo real (/v1/models)                                          */
/* ------------------------------------------------------------------ */

export async function listNvidiaModels(opts: {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
} = {}): Promise<{ ok: boolean; httpStatus: number | null; models: string[]; error?: string }> {
  const apiKey = getNvidiaApiKey(opts.apiKey);
  if (!apiKey) return { ok: false, httpStatus: null, models: [], error: "not_configured" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? NVIDIA_DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(`${getNvidiaBaseUrl(opts.baseUrl)}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, httpStatus: res.status, models: [], error: text.slice(0, 200) };
    }
    const parsed = JSON.parse(text);
    const models: string[] = (parsed?.data ?? [])
      .map((m: { id?: string }) => m?.id)
      .filter((id: unknown): id is string => typeof id === "string");
    return { ok: true, httpStatus: res.status, models };
  } catch (err) {
    return {
      ok: false,
      httpStatus: null,
      models: [],
      error: err instanceof Error ? err.name : "network_error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Chamada principal                                                   */
/* ------------------------------------------------------------------ */

export async function callNvidia(options: NvidiaCallOptions): Promise<NvidiaResult> {
  const {
    model,
    messages,
    temperature = 0.7,
    maxTokens = 512,
    timeoutMs = NVIDIA_DEFAULT_TIMEOUT_MS,
  } = options;

  const apiKey = getNvidiaApiKey(options.apiKey);
  if (!apiKey) {
    throw new NvidiaProviderError("NVIDIA_API_KEY ausente", "not_configured", null, 0, model);
  }
  if (isNvidiaCircuitOpen(model)) {
    throw new NvidiaProviderError("Circuit breaker aberto", "circuit_open", null, 0, model);
  }

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${getNvidiaBaseUrl(options.baseUrl)}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    });

    const latencyMs = Date.now() - started;
    const text = await res.text();

    if (!res.ok) {
      let code = `HTTP_${res.status}`;
      let msg = text.slice(0, 240);
      try {
        const parsed = JSON.parse(text);
        code = parsed?.error?.code || parsed?.error?.type || code;
        msg = parsed?.error?.message || parsed?.detail || msg;
      } catch { /* mantém texto cru */ }
      recordNvidiaFailure(model);
      throw new NvidiaProviderError(String(msg), String(code), res.status, latencyMs, model);
    }

    const parsed = JSON.parse(text);
    const content: string = parsed?.choices?.[0]?.message?.content ?? "";
    recordNvidiaSuccess(model);

    return {
      content,
      provider: "nvidia",
      model: parsed?.model ?? model,
      latencyMs,
      usage: {
        inputTokens: parsed?.usage?.prompt_tokens ?? 0,
        outputTokens: parsed?.usage?.completion_tokens ?? 0,
      },
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

/* ------------------------------------------------------------------ */
/* Telemetria — compatível com ai_runtime_logs (sem mudar schema)      */
/* ------------------------------------------------------------------ */

export interface NvidiaTelemetryInput {
  taskType: string;
  model: string;
  success: boolean;
  latencyMs: number;
  fallbackUsed?: boolean;
  errorCode?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  userId?: string | null;
  requestId?: string | null;
}

export function buildNvidiaRuntimeLog(input: NvidiaTelemetryInput) {
  return {
    task_type: input.taskType,
    provider: "nvidia",
    model: input.model,
    success: input.success,
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    fallback_used: input.fallbackUsed ?? false,
    fallback_chain: [],
    attempts: [{ provider: "nvidia", model: input.model, success: input.success }],
    error_code: input.errorCode ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    user_id: input.userId ?? null,
    request_id: input.requestId ?? null,
    metadata: { provider_registry: "nvidia", activation_stage: "shadow" },
  };
}

// deno-lint-ignore no-explicit-any
export async function logNvidiaRuntime(supabase: any, input: NvidiaTelemetryInput) {
  try {
    await supabase.from("ai_runtime_logs").insert(buildNvidiaRuntimeLog(input));
  } catch (_err) {
    // telemetria nunca quebra o fluxo
  }
}
