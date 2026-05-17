/**
 * ENAZIZI ENTERPRISE — AI Router (v2026)
 * Centralized AI execution with dynamic routing, governance, cost tracking, and observability.
 */

import { StructuredLogger } from "./structured-logger.ts";
import { ALLOWED_MODELS, PRODUCTION_MODELS, MODEL_METRICS } from "../ai-model-registry.ts";
import { getTokenParameterName } from "../ai-models.ts";

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

  const fastModels: AiTaskType[] = ["classification", "parsing", "flashcard", "summary"];
  const reasoningModels: AiTaskType[] = ["reasoning", "tutor_deep", "question_upgrade", "differential_diagnosis"];

  if (request.taskType && reasoningModels.includes(request.taskType)) {
    return ALLOWED_MODELS.reasoning;
  }

  return ALLOWED_MODELS.generation;
}

export async function callAi(
  payload: AiRequest,
  logger: StructuredLogger,
  supabaseAdmin: any
) {
  const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // 1. Dynamic Routing
  let model = routeModel(payload);
  
  // 2. Registry Validation
  if (!PRODUCTION_MODELS.includes(model)) {
    const originalModel = model;
    model = ALLOWED_MODELS.generation;
    logger.warn("INVALID_MODEL_REPLACED", `Model ${originalModel} is not in production registry. Falling back to ${model}`, {
      original_model: originalModel,
      replacement_model: model
    });
    
    await supabaseAdmin.from("ai_incidents").insert({
      function_name: "ai-router",
      model_name: originalModel,
      severity: "warning",
      incident_type: "validation_error",
      message: `Invalid AI model replaced: ${originalModel}`,
      correlation_id: logger.correlationId
    });
  }

  const startTime = Date.now();
  logger.info("AI_CALL", `Calling model ${model}`, { model, taskType: payload.taskType, stream: !!payload.stream });

  const tokenParam = getTokenParameterName(model);
  const normalizedPayload = { ...payload, model };
  
  const normalizedPayload = { 
    ...payload, 
    model,
    response_format: { type: "json_object" } 
  };
  
  // Strip non-standard fields for the gateway
  delete (normalizedPayload as any).taskType;

  if (payload.max_tokens && tokenParam === "max_completion_tokens") {
    // @ts-ignore: mapping to new token param
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
    logger.error("AI_ERROR", `Model ${model} failed`, { status: res.status, error: errorText });
    
    await supabaseAdmin.from("ai_incidents").insert({
      function_name: "ai-router",
      model_name: model,
      severity: "critical",
      incident_type: "gateway_error",
      message: `AI Gateway error ${res.status}: ${errorText}`,
      correlation_id: logger.correlationId,
      metadata: { status: res.status }
    });

    throw new Error(`AI Gateway error ${res.status}: ${errorText}`);
  }

  if (payload.stream) return res;

  const data = await res.json();
  const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
  const cost = calculateCost(model, usage);
  
  // 3. Governance Logging
  try {
    await supabaseAdmin.from("ai_governance_logs").insert({
      model_used: model,
      latency_ms: latency,
      token_usage: usage,
      cost_usd: cost,
      status: "success",
      metadata: { 
        task_type: payload.taskType,
        request_id: data.id,
        correlation_id: logger.correlationId
      }
    });
  } catch (err) {
    logger.warn("GOVERNANCE_ERROR", "Failed to log AI governance", { error: err.message });
  }

  return data;
}
