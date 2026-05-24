
/**
 * ENAZIZI — AI Router (v2026.3 - Enterprise Resilient)
 * Implements fallback, circuit breaker, quota management and cache.
 */

import { StructuredLogger } from "./structured-logger.ts";
import { MODEL_METRICS, ALLOWED_MODELS } from "../ai-model-registry.ts";
import { getTokenParameterName, normalizeModel } from "../ai-models.ts";
import { AiRoutingEngine, AiTaskType, CognitiveState } from "./ai-routing-engine.ts";
import { AiProviderHealth } from "./ai-provider-health.ts";
import { aiGatewayManager } from "../ai-gateway-manager.ts";

export interface AiRequest {
  model?: string;
  taskType?: AiTaskType;
  cognitiveState?: CognitiveState;
  complexity?: "baixa" | "média" | "alta";
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  response_format?: { type: "json_object" | "text" };
  userId?: string;
}

const FALLBACK_CHAINS = {
  FAST: [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash"
  ],
  REASONING: [
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "openai/o3-mini"
  ]
};

export async function callAi(
  payload: AiRequest,
  logger: StructuredLogger,
  supabaseAdmin: any,
  waitUntil?: (promise: Promise<any>) => void
) {
  const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // 1. Determine Tier and Initial Model
  const tier = (payload.complexity === "alta" || payload.taskType === "reasoning") ? 'REASONING' : 'FAST';
  const routing = AiRoutingEngine.route({
    taskType: payload.taskType,
    cognitiveState: payload.cognitiveState,
    complexity: payload.complexity
  });

  const baseModel = payload.model || routing.model;
  
  // 2. Failover Chain Preparation
  const chain = [normalizeModel(baseModel), ...FALLBACK_CHAINS[tier]];
  const uniqueModels = [...new Set(chain)];

  // 3. Global Cache Check
  if (!payload.stream) {
    const promptText = payload.messages.map(m => m.content).join("\n");
    const cached = await aiGatewayManager.getFromCache(promptText, uniqueModels[0]);
    if (cached) {
      logger.info("CACHE_HIT", `Serving cached content for ${uniqueModels[0]}`);
      return cached;
    }
  }

  let lastError = null;

  // 4. Fallback Loop
  for (const model of uniqueModels) {
    const provider = model.split('/')[0] || "unknown";
    const modelName = model.split('/')[1] || model;

    // Quota/Cooldown Check
    const isAvailable = await aiGatewayManager.isAvailable(provider, model);
    if (!isAvailable) {
      logger.warn("PROVIDER_COOLDOWN_SKIP", `Skipping ${model} due to active cooldown`);
      continue;
    }

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        const tokenParam = getTokenParameterName(model);
        const normalizedPayload: any = { ...payload, model: modelName };
        
        // Clean payload
        delete normalizedPayload.taskType;
        delete normalizedPayload.cognitiveState;
        delete normalizedPayload.complexity;
        delete normalizedPayload.userId;

        if (payload.max_tokens && tokenParam === "max_completion_tokens") {
          normalizedPayload.max_completion_tokens = payload.max_tokens;
          delete normalizedPayload.max_tokens;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        let res: Response;
        let isDirect = false;

        // Try direct OpenAI if applicable
        if (OPENAI_API_KEY && (provider === "openai")) {
          res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(normalizedPayload),
            signal: controller.signal
          });
          isDirect = true;
        } else {
          // Use Lovable Gateway for everything else (Gemini, Anthropic, etc)
          res = await fetch(LOVABLE_GATEWAY, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
              "X-Correlation-Id": logger.correlationId
            },
            body: JSON.stringify({ ...normalizedPayload, model }),
            signal: controller.signal
          });
        }

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        if (res.ok) {
          if (payload.stream) return res;

          const data = await res.json();
          
          // Log metrics asynchronously
          if (waitUntil) {
            waitUntil(aiGatewayManager.logMetric({
              provider,
              model,
              operation: "callAi",
              latency_ms: latency,
              prompt_tokens: data.usage?.prompt_tokens,
              completion_tokens: data.usage?.completion_tokens,
              success: true,
              status_code: res.status
            }));

            // Set Cache
            const promptText = payload.messages.map(m => m.content).join("\n");
            waitUntil(aiGatewayManager.setCache(promptText, model, provider, data));
          }

          return data;
        }

        // Handle failure
        const errorText = await res.text();
        logger.warn("AI_CALL_FAILED", `Model ${model} failed with status ${res.status}`, { error: errorText });

        if (waitUntil) {
          waitUntil(aiGatewayManager.logFailure({
            provider,
            model,
            error_code: String(res.status),
            error_message: errorText,
            fallback_model: uniqueModels[uniqueModels.indexOf(model) + 1]
          }));
        }

        if (res.status === 429) {
          // Immediate fallback on rate limit
          break; 
        }

        // For other retryable errors, wait before retrying same model
        if ([500, 502, 503, 504].includes(res.status)) {
           await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
           continue;
        }
        
        // Non-retryable error, move to next model
        break;

      } catch (err) {
        logger.error("AI_EXCEPTION", `Exception calling ${model}`, { error: err.message });
        lastError = err;
        break; // Move to next model on exception
      }
    }
  }

  throw lastError || new Error("ALL_AI_PROVIDERS_EXHAUSTED_OR_COOLDOWN");
}
