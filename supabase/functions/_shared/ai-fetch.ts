// Shared AI fetch helper with retry, backoff, and OpenAI fallback
// Re-exports model tiering utilities for convenience

export { getModelForTier, getRecommendedTier, getMaxTokensForTier, type ModelTier } from "./ai-model-tier.ts";
export { buildCacheKey, getCachedContent, setCachedContent, logAiUsage } from "./ai-cache.ts";
import { ALLOWED_MODELS } from "./ai-model-registry.ts";
import { normalizeModel, validatePayload } from "./model-normalizer.ts";
import { getTokenParameterName } from "./ai-models.ts";
import { logPipelineAlert } from "./pipeline-logger.ts";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_API = "https://api.openai.com/v1/chat/completions";

/**
 * ENAZIZI PRODUCTION SAFE MODE
 * When enabled, forces google/gemini-2.5-flash, disables complex response_formats,
 * and uses standard payloads to maximize stability.
 */
const PRODUCTION_SAFE_MODE = false;

const OPENAI_MAX_TOKENS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
};

// Retryable status codes (transient errors)
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

interface AiFetchOptions {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  maxRetries?: number;
  timeoutMs?: number;
  maxTokens?: number;
  /** Optional user ID for rate limiting (10 calls/min per user) */
  userId?: string;
}

// ── In-memory rate limiter (per edge function instance) ────────
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent);
    return false; // rate limited
  }
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true; // allowed
}

// Cleanup stale entries
function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, recent);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);

      // Non-retryable status → return immediately
      if (!RETRYABLE_STATUSES.has(response.status)) {
        return response;
      }

      // Retryable status → consume body, log, and retry
      const errBody = await response.text();
      console.warn(`[${label}] Attempt ${attempt + 1}/${maxRetries + 1} got ${response.status}: ${errBody.slice(0, 200)}`);
      lastResponse = response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout = lastError.name === "AbortError";
      console.warn(`[${label}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${isTimeout ? "TIMEOUT" : lastError.message}`);
    }

    // Exponential backoff
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // All retries exhausted
  if (lastError) throw lastError;
  throw new Error(`[${label}] All ${maxRetries + 1} attempts failed with status ${lastResponse?.status}`);
}

export async function aiFetch(options: AiFetchOptions): Promise<Response> {
  const source = (Deno.env.get("FUNCTION_NAME") || "unknown-edge-function");

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Helper inside aiFetch to use its scope (messages, getTokenParameterName, etc.)
  const buildPayload = (model: string, isOpenAI = false) => {
    let maxTokens = options.maxTokens ?? 16384;
    let temperature = 1;
    
    if (PRODUCTION_SAFE_MODE) {
      maxTokens = 1200;
    } else if (isOpenAI) {
      const modelClean = model.replace("openai/", "");
      const modelMax = OPENAI_MAX_TOKENS[modelClean] || 16384;
      maxTokens = Math.min(maxTokens, modelMax);
    }
    
    const tokenKey = getTokenParameterName(model);
    
    const body: any = { 
      model: model, 
      messages: options.messages, 
      [tokenKey]: maxTokens,
      temperature
    };
    
    if (options.stream !== undefined) body.stream = options.stream;
    
    if (!PRODUCTION_SAFE_MODE) {
      if (options.tools) body.tools = options.tools;
      if (options.tool_choice) body.tool_choice = options.tool_choice;
      if (options.response_format) body.response_format = options.response_format;
    }
    
    return body;
  };

  // 1. Try direct OpenAI first if available
  if (OPENAI_API_KEY) {
    try {
      // Prioritize the requested model, but ensure it's mapped correctly for direct OpenAI
      const requestedModel = options.model || "gpt-4o";
      const modelForOpenAI = requestedModel.startsWith("openai/") 
        ? requestedModel.replace("openai/", "") 
        : requestedModel;
      
      const payload = buildPayload(modelForOpenAI, true);
      console.log("[AI_PIPELINE_DIRECT_OPENAI]", { source, model: modelForOpenAI });
      
      const response = await fetchWithRetry(
        OPENAI_API,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        options.maxRetries ?? 2,
        options.timeoutMs ?? 90000,
        "OpenAI-Primary",
      );

      if (response.ok) return response;
      console.warn("[AI_PIPELINE_DIRECT_OPENAI_FAILED]", response.status);
    } catch (err) {
      console.error("[AI_PIPELINE_DIRECT_OPENAI_EXCEPTION]", err);
    }
  }

  // Rate limit check
  cleanupRateLimitMap();
  if (options.userId && !checkRateLimit(options.userId)) {
    console.warn(`[aiFetch] Rate limited user ${options.userId}`);
    await logPipelineAlert({
      source,
      message: "AI Rate Limited",
      severity: "warning",
      alert_type: "rate_limit",
      metadata: { userId: options.userId }
    });
    throw new Error("AI_RATE_LIMITED");
  }

  // Fallback to Gemini (via Lovable Gateway)
  if (LOVABLE_API_KEY) {
    try {
      const fallbackModel = "google/gemini-2.5-flash";
      const fallbackPayload = buildPayload(fallbackModel);
      console.log("[AI_PIPELINE_GEMINI_FALLBACK]", { source, model: fallbackModel });

      const response = await fetchWithRetry(
        LOVABLE_GATEWAY,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fallbackPayload),
        },
        options.maxRetries ?? 2,
        options.timeoutMs ?? 90000,
        "Lovable-Gateway-Gemini",
      );

      console.log("[AI_PIPELINE_AFTER_GEMINI_FALLBACK]", {
        status: response.status,
        ok: response.ok,
        provider: "gemini-fallback",
        timestamp: new Date().toISOString()
      });

      if (response.ok) return response;

      const errText = await response.clone().text();
      await logPipelineAlert({
        source,
        message: `Gemini Fallback Error: ${response.status}`,
        alert_type: "fallback_error",
        error_stack: errText,
        http_status: response.status,
        model_used: "google/gemini-2.5-flash",
        severity: "critical"
      });
      throw new Error("AI_SERVICE_UNAVAILABLE");
    } catch (err) {
      if (err instanceof Error && (err.message.startsWith("AI_") || err.message.startsWith("VALIDATION_ERROR"))) throw err;
      console.error("Gemini fallback all retries failed:", err);
      throw new Error("AI_SERVICE_UNAVAILABLE");
    }
  }

  throw new Error("AI_SERVICE_UNAVAILABLE");
}

export function getAiErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === "AI_CREDITS_EXHAUSTED") return "Créditos de IA esgotados. Tente novamente mais tarde.";
  if (msg === "AI_RATE_LIMITED") return "Muitas requisições simultâneas. Aguarde um momento e tente novamente.";
  if (msg === "AI_SERVICE_UNAVAILABLE") return "Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.";
  return "Erro inesperado no serviço de IA. Tente novamente.";
}

export function sanitizeAiContent(raw: string): string {
  let cleaned = raw.replace(/[\x00-\x1F\x7F]/g, (ch: string) =>
    ch === '\n' || ch === '\r' || ch === '\t' ? ch : ' '
  );
  cleaned = cleaned.replace(/\$([^$]{1,60})\$/g, (_match: string, inner: string) => {
    let result = inner.trim().replace(/\s+/g, '');
    result = result.replace(/\\times/g, '×');
    result = result.replace(/\\%/g, '%');
    result = result.replace(/~/g, '');
    result = result.replace(/\\text\{([^}]*)\}/g, '$1');
    result = result.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    result = result.replace(/\\,/g, ' ');
    result = result.replace(/\\/g, '');
    return result;
  });
  cleaned = cleaned.replace(/\\times\b/g, '×');
  cleaned = cleaned.replace(/\\%/g, '%');
  return cleaned;
}

export function cleanQuestionText(text: string): string {
  if (!text) return text;
  let cleaned = text;
  cleaned = cleaned.replace(/\$([^$]{1,80})\$/g, (_m: string, inner: string) => {
    let r = inner.trim().replace(/\s+/g, '');
    r = r.replace(/\\times/g, '×');
    r = r.replace(/\\%/g, '%');
    r = r.replace(/~/g, '');
    r = r.replace(/\\text\{([^}]*)\}/g, '$1');
    r = r.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    r = r.replace(/\\,/g, ' ');
    r = r.replace(/\\/g, '');
    return r;
  });
  cleaned = cleaned.replace(/\\times\b/g, '×');
  cleaned = cleaned.replace(/\\%/g, '%');
  cleaned = cleaned.replace(/\\textit\{([^}]*)\}/g, '$1');
  cleaned = cleaned.replace(/\\textbf\{([^}]*)\}/g, '$1');
  cleaned = cleaned.replace(/\\emph\{([^}]*)\}/g, '$1');
  return cleaned;
}

function tryParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const fixed = text
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, (ch: string) =>
        ch === '\n' || ch === '\r' || ch === '\t' ? ch : ''
      );
    try {
      return JSON.parse(fixed);
    } catch {
      let braces = 0, brackets = 0;
      for (const c of fixed) {
        if (c === '{') braces++;
        if (c === '}') braces--;
        if (c === '[') brackets++;
        if (c === ']') brackets--;
      }
      let repaired = fixed;
      while (brackets > 0) { repaired += ']'; brackets--; }
      while (braces > 0) { repaired += '}'; braces--; }
      try {
        return JSON.parse(repaired);
      } catch {
        throw new Error("Failed to parse repaired JSON");
      }
    }
  }
}

export function parseAiJson(rawContent: string): any {
  const content = sanitizeAiContent(rawContent);
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return tryParse(codeBlockMatch[1].trim());
  }
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    return tryParse(objMatch[0]);
  }
  const arrMatch = content.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    return tryParse(arrMatch[0]);
  }
  throw new Error("No valid JSON found in AI response");
}
