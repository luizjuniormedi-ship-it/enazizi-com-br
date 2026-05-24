
/**
 * ENAZIZI — AI Router v10 (OpenAI Priority & Resilience)
 * Prioritizes OpenAI, manages fallbacks to Gemini, and handles global cache.
 */

import { StructuredLogger } from "./structured-logger.ts";
import { ALLOWED_MODELS } from "../ai-model-registry.ts";
import { getTokenParameterName } from "../ai-models.ts";
import { CircuitBreaker, safeJsonParse, normalizeAIResponse, getStaticFallback } from "../ai-stability-kit.ts";
import { generateSHA256 } from "../crypto-utils.ts";

export interface AiRequest {
  model?: string;
  taskType?: "generation" | "reasoning" | "vision";
  complexity?: "baixa" | "média" | "alta";
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  response_format?: { type: "json_object" | "text" };
  userId?: string;
  skipCache?: boolean;
}

const FALLBACK_CHAINS = {
  FAST: [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini" // Last resort OpenAI
  ],
  REASONING: [
    "openai/gpt-4o",  // Alias for 4.1 if it fails
    "openai/gpt-4o",  // Alias for 4.1 if it fails
    "google/gemini-2.5-pro",
    "openai/gpt-4o"
  ]
};

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_API = "https://api.openai.com/v1/chat/completions";

export async function callAi(
  payload: AiRequest,
  logger: StructuredLogger,
  supabaseAdmin: any,
  waitUntil?: (promise: Promise<any>) => void
) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // 1. Determine Tier and Chain
  const tier = (payload.complexity === "alta" || payload.taskType === "reasoning") ? 'REASONING' : 'FAST';
  const requestedModel = payload.model;
  const baseChain = requestedModel ? [requestedModel, ...FALLBACK_CHAINS[tier]] : FALLBACK_CHAINS[tier];
  const uniqueChain = [...new Set(baseChain)];

  // 2. Global Cache Check (SHA256)
  const promptText = JSON.stringify(payload.messages);
  const cacheKey = await generateSHA256(`${promptText}_${tier}_${payload.userId || 'system'}`);
  
  if (!payload.stream && !payload.skipCache) {
    try {
      const { data: cached } = await supabaseAdmin
        .from("ai_gateway_cache")
        .select("content")
        .eq("hash", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log(`[CACHE_HIT] SHA256: ${cacheKey.substring(0, 8)}`);
        return cached.content;
      }
    } catch (e) {
      logger.warn("CACHE_CHECK_ERROR", "Failed to check global cache", { error: e.message });
    }
  }

  let lastError = null;

  // 3. Fallback Execution Loop
  for (const modelString of uniqueChain) {
    const provider = modelString.split('/')[0] || "unknown";
    const modelName = modelString.split('/')[1] || modelString;
    const circuit = CircuitBreaker.getInstance(provider);

    if (circuit.isOpen()) {
      console.warn(`[CIRCUIT_SKIP] Skipping ${provider} due to OPEN circuit.`);
      continue;
    }

    const maxRetries = provider === "openai" ? 2 : 1;
    const timeoutMs = provider === "openai" ? 25000 : 20000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[EDGE_RETRY] ${modelString} Attempt ${attempt} (Waiting ${delay}ms)`);
        await new Promise(r => setTimeout(r, delay));
      }

      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let res: Response;
        
        // REPAIR: Clean payload of custom internal arguments that OpenAI doesn't recognize
        const { taskType: _t, complexity: _c, userId: _u, skipCache: _s, messages, ...standardPayload } = payload;
        
        // Direct OpenAI if key exists and provider is openai
        if (OPENAI_API_KEY && provider === "openai") {
          res = await fetch(OPENAI_API, {
            method: "POST",
            headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ...standardPayload, model: modelName, messages }),
            signal: controller.signal
          });
        } else {
          // Use Lovable Gateway
          res = await fetch(LOVABLE_GATEWAY, {
            method: "POST",
            headers: { 
              "Authorization": `Bearer ${LOVABLE_API_KEY}`, 
              "Content-Type": "application/json",
              "X-Correlation-Id": logger.correlationId
            },
            body: JSON.stringify({ ...standardPayload, model: modelString }),
            signal: controller.signal
          });
        }

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        if (res.ok) {
          if (payload.stream) return res;
          
          const data = await res.json();
          circuit.recordSuccess();

          // Structured Success Log
          const logTag = provider === "openai" ? (attempt === 0 ? "[OPENAI_PRIMARY]" : "[OPENAI_FALLBACK]") : "[GEMINI_FALLBACK]";
          console.log(`${logTag} model: ${modelString}, latency: ${latency}ms`);

          // Background operations
          if (waitUntil) {
            // Update Cache
            const ttlHours = tier === 'REASONING' ? 6 : 12; // Adjusted TTL based on v10 requirements
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + ttlHours);
            
            waitUntil(supabaseAdmin.from("ai_gateway_cache").upsert({
              hash: cacheKey,
              content: data,
              expires_at: expiresAt.toISOString(),
              prompt_type: payload.taskType || "generation"
            }));

            // Log Metrics
            waitUntil(supabaseAdmin.from("ai_gateway_metrics").insert({
              provider,
              model: modelString,
              latency_ms: latency,
              status_code: res.status,
              success: true,
              user_id: payload.userId,
              payload_hash: cacheKey
            }));
          }

          return data;
        }

        // ─── ERROR HANDLING ──────────────────────────────────────────────────

        const errorText = await res.text();
        const isRetryable = [408, 429, 500, 502, 503, 504].includes(res.status);
        
        console.warn(`[AI_FAILURE] ${modelString} status: ${res.status}, body: ${errorText.substring(0, 100)}`);

        if (res.status === 429 || res.status === 402) {
          circuit.recordFailure();
          break; // Switch provider immediately
        }

        if (!isRetryable) {
          circuit.recordFailure();
          break; // Move to next model
        }

      } catch (err) {
        if (err.name === 'AbortError') {
          console.error(`[AI_TIMEOUT] ${modelString} after ${timeoutMs}ms`);
        } else {
          console.error(`[AI_EXCEPTION] ${modelString}:`, err.message);
        }
        circuit.recordFailure();
        lastError = err;
        break; // Move to next model
      }
    }
  }

  // 4. FINAL RESORT: Static Fallback
  console.error("[CRITICAL_RESILIENCE] All AI providers exhausted. Using Static Fallback.");
  const fallbackTema = "Critérios de Light"; // Default or try to extract from payload
  return normalizeAIResponse(getStaticFallback(fallbackTema));
}
