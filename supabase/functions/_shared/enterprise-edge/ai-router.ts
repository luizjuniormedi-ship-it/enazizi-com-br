/**
 * ENAZIZI — AI Router (v2026.2)
 * Refactored to support AI Routing Governance Layer and Semantic Failover.
 */

import { StructuredLogger } from "./structured-logger.ts";
import { MODEL_METRICS } from "../ai-model-registry.ts";
import { getTokenParameterName, AI_MODELS, normalizeModel } from "../ai-models.ts";
import { AiRoutingEngine, AiTaskType, CognitiveState } from "./ai-routing-engine.ts";
import { AiGovernance } from "./ai-governance.ts";
import { AiProviderHealth } from "./ai-provider-health.ts";

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

/**
 * Calculates estimated cost in USD.
 */
function calculateCost(model: string, usage: { prompt_tokens: number, completion_tokens: number }) {
  const metrics = MODEL_METRICS[model];
  if (!metrics) return 0;
  
  const promptCost = (usage.prompt_tokens / 1_000_000) * metrics.prompt;
  const completionCost = (usage.completion_tokens / 1_000_000) * metrics.completion;
  return promptCost + completionCost;
}

export async function callAi(
  payload: AiRequest,
  logger: StructuredLogger,
  supabaseAdmin: any,
  waitUntil?: (promise: Promise<any>) => void
) {
  const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // 1. Determine Model via Routing Engine
  const routing = AiRoutingEngine.route({
    taskType: payload.taskType,
    cognitiveState: payload.cognitiveState,
    complexity: payload.complexity
  });

  const baseModel = payload.model || routing.model;
  
  // 2. Prepare Models to Try (Failover Chain)
  const modelsToTry = [
    normalizeModel(baseModel),
    AI_MODELS.FAST,
    AI_MODELS.REASONING,
    AI_MODELS.FALLBACK
  ];

  const uniqueModels = [...new Set(modelsToTry)];
  let lastError = null;

  // Track the routing decision in DB
  const logRouting = (async () => {
    try {
      await supabaseAdmin.from("ai_routing_decisions").insert({
        correlation_id: logger.correlationId,
        user_id: payload.userId,
        task_type: payload.taskType,
        cognitive_state: payload.cognitiveState,
        requested_model: payload.model,
        selected_model: baseModel,
        routing_reason: routing.reason
      });
    } catch (err) {
      logger.warn("ROUTING_LOG_FAIL", err.message);
    }
  })();
  if (waitUntil) waitUntil(logRouting);

  for (const model of uniqueModels) {
    const startTime = Date.now();
    const provider = model.split('/')[0] || "unknown";

    try {
      const tokenParam = getTokenParameterName(model);
      const normalizedPayload: any = { ...payload, model };
      
      // Sanitização Final: Eliminar qualquer campo extra de modelo
      delete normalizedPayload.taskType;
      delete normalizedPayload.cognitiveState;
      delete normalizedPayload.complexity;
      delete normalizedPayload.userId;
      delete normalizedPayload.modelName;
      delete normalizedPayload.ai_model;
      delete normalizedPayload.selectedModel;

      logger.info("FINAL_AI_MODEL_BEFORE_GATEWAY", `Attempting model ${model}`, { 
        correlation_id: logger.correlationId,
        resolvedModel: model,
        originalModel: payload.model,
        taskType: payload.taskType
      });

      if (payload.max_tokens && tokenParam === "max_completion_tokens") {
        normalizedPayload.max_completion_tokens = payload.max_tokens;
        delete normalizedPayload.max_tokens;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const res = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
          "X-Correlation-Id": logger.correlationId
        },
        body: JSON.stringify(normalizedPayload),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      const latency = Date.now() - startTime;

      if (!res.ok) {
        const errorText = await res.text();
        
        // Report health
        const reportError = (async () => {
          await AiProviderHealth.reportStatus(supabaseAdmin, logger, {
            provider,
            model,
            status: "error",
            latencyMs: latency,
            error: errorText
          });
        })();
        if (waitUntil) waitUntil(reportError);

        if (res.status === 400 && (errorText.includes("invalid model") || errorText.includes("Unsupported model"))) {
          logger.warn("AI_MODEL_INVALID", `Model ${model} rejected. Retrying chain.`);
          continue; 
        }

        lastError = new Error(`AI Gateway error ${res.status}: ${errorText}`);
        continue;
      }

      if (payload.stream) return res;

      const data = await res.json();
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const cost = calculateCost(model, usage);
      
      // Governance & Health
      const reportSuccess = (async () => {
        await AiProviderHealth.reportStatus(supabaseAdmin, logger, {
          provider,
          model,
          status: "success",
          latencyMs: latency
        });

        await AiGovernance.logResponse(supabaseAdmin, logger, {
          model,
          latency,
          cost,
          usage,
          correlationId: logger.correlationId,
          taskType: payload.taskType
        });
      })();
      if (waitUntil) waitUntil(reportSuccess);

      return data;
    } catch (error) {
      logger.error("AI_EXCEPTION", `Exception calling ${model}`, { error: error.message });
      lastError = error;
      continue;
    }
  }

  throw lastError || new Error("ALL_AI_MODELS_FAILED");
}
