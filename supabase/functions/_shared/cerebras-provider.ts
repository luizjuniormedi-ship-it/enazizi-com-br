/**
 * Cerebras Provider — ENAZIZI (OPT-IN / NÃO ATIVO EM PRODUÇÃO)
 * ------------------------------------------------------------------
 * Cliente compartilhado backend para a API OpenAI-compatible da Cerebras.
 *
 * Contrato:
 *   baseUrl: CEREBRAS_BASE_URL || https://api.cerebras.ai/v1
 *   auth:    Authorization: Bearer ${CEREBRAS_API_KEY}
 *   rota:    POST /chat/completions   |   GET /models
 *
 * REGRAS:
 * - A chave NUNCA é logada, retornada, nem exposta ao frontend.
 * - Provider fica DESABILITADO enquanto CEREBRAS_API_KEY estiver ausente.
 * - Circuit breaker isolado: não afeta NVIDIA/OpenAI/Gemini/Claude.
 */

export const CEREBRAS_DEFAULT_BASE_URL = "https://api.cerebras.ai/v1";
export const CEREBRAS_DEFAULT_TIMEOUT_MS = 30_000;

export interface CerebrasMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CerebrasCallOptions {
  model: string;
  messages: CerebrasMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface CerebrasResult {
  content: string;
  provider: "cerebras";
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  raw: unknown;
}

export class CerebrasProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number | null,
    public readonly latencyMs: number,
    public readonly model: string,
  ) {
    super(message);
    this.name = "CerebrasProviderError";
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

export function getCerebrasApiKey(explicit?: string): string | null {
  const key = explicit || env("CEREBRAS_API_KEY");
  return key && key.trim().length > 0 ? key.trim() : null;
}

export function getCerebrasBaseUrl(explicit?: string): string {
  const raw = explicit || env("CEREBRAS_BASE_URL") || CEREBRAS_DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/** Provider só é considerado habilitado quando o secret existe. */
export function isCerebrasEnabled(explicitKey?: string): boolean {
  return getCerebrasApiKey(explicitKey) !== null;
}

/* ------------------------------------------------------------------ */
/* Circuit breaker isolado (por provider/model)                        */
/* ------------------------------------------------------------------ */

export const CEREBRAS_BREAKER_THRESHOLD = 3;
export const CEREBRAS_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

interface BreakerState {
  failures: number;
  openedAt: number | null;
}

const breakerStore = new Map<string, BreakerState>();

function breakerKey(model: string) {
  return `cerebras:${model}`;
}

export function isCerebrasCircuitOpen(model: string, now = Date.now()): boolean {
  const state = breakerStore.get(breakerKey(model));
  if (!state?.openedAt) return false;
  if (now - state.openedAt >= CEREBRAS_BREAKER_COOLDOWN_MS) {
    breakerStore.delete(breakerKey(model));
    return false;
  }
  return true;
}

export function recordCerebrasFailure(model: string, now = Date.now()): void {
  const key = breakerKey(model);
  const state = breakerStore.get(key) ?? { failures: 0, openedAt: null };
  state.failures += 1;
  if (state.failures >= CEREBRAS_BREAKER_THRESHOLD) state.openedAt = now;
  breakerStore.set(key, state);
}

export function recordCerebrasSuccess(model: string): void {
  breakerStore.delete(breakerKey(model));
}

export function resetCerebrasBreaker(model?: string): void {
  if (model) breakerStore.delete(breakerKey(model));
  else breakerStore.clear();
}

/* ------------------------------------------------------------------ */
/* Catálogo real (/v1/models ou /public/v1/models)                     */
/* ------------------------------------------------------------------ */

export async function listCerebrasModels(opts: {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
} = {}): Promise<{ ok: boolean; httpStatus: number | null; models: string[]; error?: string }> {
  const apiKey = getCerebrasApiKey(opts.apiKey);
  const baseUrl = getCerebrasBaseUrl(opts.baseUrl);
  
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? CEREBRAS_DEFAULT_TIMEOUT_MS);
  
  try {
    // Tenta primeiro o endpoint autenticado
    let res = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: ctrl.signal,
    });
    
    // Se falhar, tenta o catálogo público
    if (!res.ok && res.status !== 401) {
       res = await fetch(`${baseUrl.replace(/\/v1$/, "")}/public/v1/models`, {
         signal: ctrl.signal,
       });
    }

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

export async function callCerebras(options: CerebrasCallOptions): Promise<CerebrasResult> {
  const {
    model,
    messages,
    temperature = 0.7,
    maxTokens = 512,
    timeoutMs = CEREBRAS_DEFAULT_TIMEOUT_MS,
  } = options;

  const apiKey = getCerebrasApiKey(options.apiKey);
  if (!apiKey) {
    throw new CerebrasProviderError("CEREBRAS_API_KEY ausente", "not_configured", null, 0, model);
  }
  if (isCerebrasCircuitOpen(model)) {
    throw new CerebrasProviderError("Circuit breaker aberto", "circuit_open", null, 0, model);
  }

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  // Hardening EG-2: retry budget for specific models
  const effectiveMaxTokens = (model.includes("zai-glm-4.7") || model.includes("oss")) && maxTokens < 1000 
    ? 1000 
    : maxTokens;

  try {
    const res = await fetch(`${getCerebrasBaseUrl(options.baseUrl)}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        model, 
        messages, 
        temperature, 
        max_tokens: effectiveMaxTokens, 
        stream: false 
      }),
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
      recordCerebrasFailure(model);
      throw new CerebrasProviderError(String(msg), String(code), res.status, latencyMs, model);
    }

    const parsed = JSON.parse(text);
    const content: string = parsed?.choices?.[0]?.message?.content || "";
    const reasoning: string = parsed?.choices?.[0]?.message?.reasoning || "";

    // EG-2 Guard: Handle INCOMPLETE_GENERATION
    if (content === "" && reasoning !== "") {
      // Se tivermos apenas reasoning, consideramos INCOMPLETE e tentamos um retry rápido com mais tokens
      // se ainda não tivermos esgotado o tempo total.
      const timeRemaining = timeoutMs - (Date.now() - started);
      if (timeRemaining > 5000) { // pelo menos 5s para o retry
         return callCerebras({
           ...options,
           maxTokens: Math.max(effectiveMaxTokens * 2, 2048),
           timeoutMs: timeRemaining
         });
      }
      // Se não der tempo de retry, falhamos para o fallback
      recordCerebrasFailure(model);
      throw new CerebrasProviderError("INCOMPLETE_GENERATION: reasoning present but content empty", "incomplete", res.status, latencyMs, model);
    }

    if (content === "" && reasoning === "") {
      recordCerebrasFailure(model);
      throw new CerebrasProviderError("EMPTY_GENERATION", "empty", res.status, latencyMs, model);
    }

    recordCerebrasSuccess(model);

    return {
      content,
      provider: "cerebras",
      model: parsed?.model ?? model,
      latencyMs,
      usage: {
        inputTokens: parsed?.usage?.prompt_tokens ?? 0,
        outputTokens: parsed?.usage?.completion_tokens ?? 0,
      },
      raw: parsed,
    };
  } catch (err) {
    if (err instanceof CerebrasProviderError) throw err;
    const latencyMs = Date.now() - started;
    recordCerebrasFailure(model);
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new CerebrasProviderError(
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

export interface CerebrasTelemetryInput {
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

export function buildCerebrasRuntimeLog(input: CerebrasTelemetryInput) {
  return {
    task_type: input.taskType,
    provider: "cerebras",
    model: input.model,
    success: input.success,
    latency_ms: Math.max(0, Math.round(input.latencyMs)),
    fallback_used: input.fallbackUsed ?? false,
    fallback_chain: [],
    attempts: [{ provider: "cerebras", model: input.model, success: input.success }],
    error_code: input.errorCode ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    user_id: input.userId ?? null,
    request_id: input.requestId ?? null,
    metadata: { provider_registry: "cerebras", activation_stage: "shadow" },
  };
}

// deno-lint-ignore no-explicit-any
export async function logCerebrasRuntime(supabase: any, input: CerebrasTelemetryInput) {
  try {
    await supabase.from("ai_runtime_logs").insert(buildCerebrasRuntimeLog(input));
  } catch (_err) {
    // telemetria nunca quebra o fluxo
  }
}
