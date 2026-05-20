/**
 * ENAZIZI ENTERPRISE — AI Router (v2026)
 * Centralized AI execution with dynamic routing, governance, cost tracking, and observability.
 */

import { StructuredLogger } from "./structured-logger.ts";
import { ALLOWED_MODELS, PRODUCTION_MODELS, MODEL_METRICS } from "../ai-model-registry.ts";
import { getTokenParameterName, AI_MODELS, normalizeModel } from "../ai-models.ts";

export type AiTaskType = 
  | "classification" 
  | "parsing" 
  | "flashcard" 
  | "summary" 
  | "reasoning" 
  | "tutor_deep" 
  | "question_upgrade"
  | "differential_diagnosis";

export interface AiRequest {
  model?: string;
  taskType?: AiTaskType;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  response_format?: { type: "json_object" | "text" };
}

/**
 * Calculates estimated cost in USD based on model and token usage.
 */
function calculateCost(model: string, usage: { prompt_tokens: number, completion_tokens: number }) {
  const metrics = MODEL_METRICS[model];
  if (!metrics) return 0;
  
  const promptCost = (usage.prompt_tokens / 1_000_000) * metrics.prompt;
  const completionCost = (usage.completion_tokens / 1_000_000) * metrics.completion;
  return promptCost + completionCost;
}

/**
 * Decides which model to use based on task complexity.
 */
function routeModel(request: AiRequest): string {
  if (request.model) return request.model;

  const reasoningModels: AiTaskType[] = ["reasoning", "tutor_deep", "question_upgrade", "differential_diagnosis"];

  if (request.taskType && reasoningModels.includes(request.taskType)) {
    return AI_MODELS.REASONING;
  }

  return AI_MODELS.FAST;
}

/**
 * Executes AI call with automatic fallback logic.
 */
async function callAIGatewayWithFallback(
  payload: any,
  logger: StructuredLogger,
  supabaseAdmin: any
) {
  const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const modelsToTry = [
    normalizeModel(payload.model),
    AI_MODELS.FAST,
    AI_MODELS.REASONING,
    AI_MODELS.FALLBACK
  ];

  const uniqueModels = [...new Set(modelsToTry)];
  let lastError = null;

  for (const model of uniqueModels) {
    const startTime = Date.now();
    try {
      logger.info("AI_CALL_ATTEMPT", `Trying model ${model}`, { 
        model, 
        correlation_id: logger.correlationId 
      });

      const tokenParam = getTokenParameterName(model);
      const normalizedPayload: any = { ...payload, model };
      
      // Strip non-standard fields for the gateway
      delete (normalizedPayload as any).taskType;

      if (payload.max_tokens && tokenParam === "max_completion_tokens") {
        normalizedPayload.max_completion_tokens = payload.max_tokens;
        delete normalizedPayload.max_tokens;
      }

      const res = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedPayload),
      });

      const latency = Date.now() - startTime;

      if (!res.ok) {
        const errorText = await res.text();
        
        // If it's an "invalid model" error, we continue to next fallback
        if (res.status === 400 && (errorText.includes("invalid model") || errorText.includes("Unsupported model"))) {
          logger.warn("AI_MODEL_INVALID", `Model ${model} rejected by gateway. Trying fallback.`, { 
            status: res.status, 
            error: errorText 
          });
          continue; 
        }

        // For other errors, we might want to log incident and throw or continue
        logger.error("AI_GATEWAY_ERROR", `Model ${model} failed with ${res.status}`, { error: errorText });
        lastError = new Error(`AI Gateway error ${res.status}: ${errorText}`);
        continue;
      }

      if (payload.stream) return res;

      const data = await res.json();
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const cost = calculateCost(model, usage);
      
      // Governance Logging
      try {
        const governanceData = {
          function_name: Deno.env.get("FUNCTION_NAME") || "ai-router",
          model_used: model,
          model_name: model,
          latency_ms: latency,
          token_usage: usage,
          cost_usd: cost,
          status: "success",
          metadata: { 
            task_type: payload.taskType,
            request_id: data.id,
            correlation_id: logger.correlationId,
            was_fallback: model !== uniqueModels[0]
          }
        };
        
        const logPromise = supabaseAdmin.from("ai_governance_logs").insert(governanceData);
        if (typeof (Deno as any).waitUntil === 'function') {
          (Deno as any).waitUntil(logPromise);
        }
      } catch (err) {
        logger.warn("GOVERNANCE_LOG_FAIL", "Failed to log AI governance", { error: err.message });
      }

      return data;
    } catch (error) {
      logger.error("AI_EXECUTION_EXCEPTION", `Exception calling ${model}`, { error: error.message });
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error("ALL_AI_MODELS_FAILED");
}

export async function callAi(
  payload: AiRequest,
  logger: StructuredLogger,
  supabaseAdmin: any
) {
  // 1. Dynamic Routing
  const model = routeModel(payload);
  
  // 2. Execute with Fallback
  return await callAIGatewayWithFallback({ ...payload, model }, logger, supabaseAdmin);
}
