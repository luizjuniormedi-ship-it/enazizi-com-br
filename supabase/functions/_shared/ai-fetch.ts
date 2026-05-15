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
 * When enabled, forces gpt-4o-mini, disables complex response_formats,
 * and uses standard payloads to maximize stability.
 */
const PRODUCTION_SAFE_MODE = false;

const OPENAI_MAX_TOKENS: Record<string, number> = {
  "gpt-4o-mini": 16384,
  "gpt-4o": 16384,
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
// TODO(post-freeze): este limiter é in-memory e não é compartilhado entre
// instâncias Edge/serverless — cada cold start reinicia o estado.
// Pós-freeze: migrar para rate limiting via tabela Supabase ou KV distribuído.
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

// Cleanup stale entries (no longer using setInterval at top level)
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

    // Exponential backoff: 1s, 2s, 4s
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

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // 1. Normalize Model & Apply Safe Mode
  let rawModel = options.model || ALLOWED_MODELS.generation;
  
  if (PRODUCTION_SAFE_MODE) {
    console.log("[SAFE_MODE] Overriding model to gpt-4o-mini");
    rawModel = "openai/gpt-5-mini";
  }
  
  const normalizedModel = normalizeModel(rawModel);
  
  // 2. Build Payload
  const buildPayload = (model: string, isOpenAI = false) => {
    let maxTokens = options.maxTokens ?? 16384;
    let temperature = 1; // Standard temperature for stability
    
    if (PRODUCTION_SAFE_MODE) {
      maxTokens = 1200; // Forced safe token limit
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
    
    // Disable complex features in Safe Mode
    if (!PRODUCTION_SAFE_MODE) {
      if (options.tools) body.tools = options.tools;
      if (options.tool_choice) body.tool_choice = options.tool_choice;
      if (options.response_format) body.response_format = options.response_format;
    } else {
      if (options.tools || options.response_format) {
        console.warn("[SAFE_MODE] Stripping tools/response_format from payload");
      }
    }
    
    return body;
  };

  const payload = buildPayload(normalizedModel);

  // 3. Block Invalid Payloads
  const validation = validatePayload(payload);
  if (!validation.valid) {
    const errorMsg = `Invalid AI payload: ${validation.error}`;
    console.error(`[aiFetch] ${errorMsg}`, JSON.stringify(payload, null, 2));
    await logPipelineAlert({
      source,
      message: errorMsg,
      severity: "critical",
      alert_type: "validation_error",
      model_used: normalizedModel,
      metadata: { payload_error: validation.error, safe_mode: PRODUCTION_SAFE_MODE }
    });
    throw new Error(`VALIDATION_ERROR: ${validation.error}`);
  }

  // 4. Forensic Logs BEFORE call
  console.log("[AI_PIPELINE_BEFORE]", {
    function: source,
    rawModel,
    normalizedModel,
    payloadModel: payload.model,
    provider: "lovable-gateway",
    messagesCount: options.messages.length,
    payloadSize: JSON.stringify(payload).length,
    response_format: !!payload.response_format,
    safe_mode: PRODUCTION_SAFE_MODE,
    timestamp: new Date().toISOString()
  });

  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 90000;

  // Try Lovable AI first
  if (LOVABLE_API_KEY) {
    try {
      const response = await fetchWithRetry(
        LOVABLE_GATEWAY,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        maxRetries,
        timeoutMs,
        "LovableAI",
      );

      // Forensic Logs AFTER call (Success)
      const duration = Date.now() - new Date(payload.timestamp || Date.now()).getTime(); // Approximate
      console.log("[AI_PIPELINE_AFTER]", {
        status: response.status,
        ok: response.ok,
        provider: "lovable-gateway",
        success: true,
        timestamp: new Date().toISOString()
      });

      if (response.ok) {
        return response;
      }

      // If not a credit/rate issue, log it
      const errorBody = await response.clone().text();
      console.error(`[AI_PIPELINE_ERROR] Lovable AI Gateway Error ${response.status}:`, errorBody);
      
      await logPipelineAlert({
        source,
        message: `Lovable AI Gateway Error: ${response.status}`,
        alert_type: "gateway_error",
        error_stack: errorBody,
        http_status: response.status,
        model_used: normalizedModel,
        metadata: { gatewayResponse: errorBody }
      });

      if (response.status === 400) {
        throw new Error(`GATEWAY_ERROR_400: ${errorBody.slice(0, 100)}`);
      }
      
    } catch (fetchErr) {
      console.error("[AI_PIPELINE_EXCEPTION] Lovable AI failed:", fetchErr);
      await logPipelineAlert({
        source,
        message: "Lovable AI Fetch Exception",
        alert_type: "fetch_exception",
        error_stack: fetchErr instanceof Error ? fetchErr.stack : String(fetchErr),
        severity: "error",
        model_used: normalizedModel
      });
    }
  }

  // Fallback to OpenAI
  if (!OPENAI_API_KEY) {
    await logPipelineAlert({
      source,
      message: "AI Credits Exhausted (No OpenAI Key)",
      alert_type: "credits_exhausted",
      severity: "critical"
    });
    throw new Error("AI_CREDITS_EXHAUSTED");
  }

  const openaiModel = normalizedModel.replace("openai/", "");
  const openaiPayload = buildPayload(openaiModel, true);

  console.log("[AI_PIPELINE_FALLBACK]", {
    originalModel: normalizedModel,
    openaiModel,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetchWithRetry(
      OPENAI_API,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(openaiPayload),
      },
      maxRetries,
      timeoutMs,
      "OpenAI",
    );

    console.log("[AI_PIPELINE_AFTER_FALLBACK]", {
      status: response.status,
      ok: response.ok,
      provider: "openai",
      timestamp: new Date().toISOString()
    });

    if (!response.ok) {
      const errText = await response.clone().text();
      console.error(`OpenAI fallback failed (${response.status}):`, errText.slice(0, 300));

      await logPipelineAlert({
        source,
        message: `OpenAI Fallback Error: ${response.status}`,
        alert_type: "fallback_error",
        error_stack: errText,
        http_status: response.status,
        model_used: openaiModel,
        severity: "critical"
      });

      if (response.status === 429) throw new Error("AI_RATE_LIMITED");
      if (response.status === 402) throw new Error("AI_CREDITS_EXHAUSTED");
      throw new Error("AI_SERVICE_UNAVAILABLE");
    }

    return response;
  } catch (err) {
    if (err instanceof Error && (err.message.startsWith("AI_") || err.message.startsWith("VALIDATION_ERROR") || err.message.startsWith("GATEWAY_ERROR"))) throw err;
    
    console.error("OpenAI all retries failed:", err);
    await logPipelineAlert({
      source,
      message: "OpenAI Fetch Exception",
      alert_type: "fallback_exception",
      error_stack: err instanceof Error ? err.stack : String(err),
      severity: "critical",
      model_used: openaiModel
    });
    throw new Error("AI_SERVICE_UNAVAILABLE");
  }
}

// Helper: map error codes to user-friendly Portuguese messages
export function getAiErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg === "AI_CREDITS_EXHAUSTED") return "Créditos de IA esgotados. Tente novamente mais tarde.";
  if (msg === "AI_RATE_LIMITED") return "Muitas requisições simultâneas. Aguarde um momento e tente novamente.";
  if (msg === "AI_SERVICE_UNAVAILABLE") return "Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.";
  return "Erro inesperado no serviço de IA. Tente novamente.";
}

/**
 * Sanitize AI response content:
 * 1. Remove control characters that break JSON.parse
 * 2. Clean LaTeX residues ($...$, \times, \%, etc.)
 * 3. Strip image/figure references without actual images
 */
export function sanitizeAiContent(raw: string): string {
  let cleaned = raw.replace(/[\x00-\x1F\x7F]/g, (ch: string) =>
    ch === '\n' || ch === '\r' || ch === '\t' ? ch : ' '
  );

  // Clean LaTeX inline math: $( 8 3 + 8 4 )$ → (83+84), $. 3 8 %$ → .38%
  cleaned = cleaned.replace(/\$([^$]{1,60})\$/g, (_match: string, inner: string) => {
    // Remove extra spaces inside LaTeX fragments
    let result = inner.trim().replace(/\s+/g, '');
    // Convert common LaTeX commands to plain text
    result = result.replace(/\\times/g, '×');
    result = result.replace(/\\%/g, '%');
    result = result.replace(/~/g, '');
    result = result.replace(/\\text\{([^}]*)\}/g, '$1');
    result = result.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    result = result.replace(/\\,/g, ' ');
    result = result.replace(/\\/g, '');
    return result;
  });

  // Clean remaining standalone LaTeX commands
  cleaned = cleaned.replace(/\\times\b/g, '×');
  cleaned = cleaned.replace(/\\%/g, '%');

  return cleaned;
}

/**
 * Clean LaTeX and encoding artifacts from a question statement or option text.
 * Applied after JSON parsing to individual text fields.
 */
export function cleanQuestionText(text: string): string {
  if (!text) return text;
  let cleaned = text;
  
  // LaTeX inline math
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
  
  // Standalone LaTeX
  cleaned = cleaned.replace(/\\times\b/g, '×');
  cleaned = cleaned.replace(/\\%/g, '%');
  cleaned = cleaned.replace(/\\textit\{([^}]*)\}/g, '$1');
  cleaned = cleaned.replace(/\\textbf\{([^}]*)\}/g, '$1');
  cleaned = cleaned.replace(/\\emph\{([^}]*)\}/g, '$1');
  
  return cleaned;
}

/**
 * Extract and parse JSON from AI response content.
 * Handles markdown code blocks and control character sanitization.
 */
function tryParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Fix common AI JSON issues: trailing commas, control chars
    const fixed = text
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, (ch: string) =>
        ch === '\n' || ch === '\r' || ch === '\t' ? ch : ''
      );
    try {
      return JSON.parse(fixed);
    } catch {
      // Try repairing unbalanced braces/brackets
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
      return JSON.parse(repaired);
    }
  }
}

export function parseAiJson(rawContent: string): any {
  const content = sanitizeAiContent(rawContent);
  
  // Try markdown code block first
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return tryParse(codeBlockMatch[1].trim());
  }
  
  // Try extracting JSON object
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) {
    return tryParse(objMatch[0]);
  }
  
  // Try extracting JSON array
  const arrMatch = content.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    return tryParse(arrMatch[0]);
  }
  
  throw new Error("No valid JSON found in AI response");
}
