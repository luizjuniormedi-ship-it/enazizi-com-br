/**
 * ENAZIZI ENTERPRISE — AI Router
 * Centralized AI execution with routing, governance, and streaming support.
 */

import { StructuredLogger } from "./structured-logger.ts";
import { ALLOWED_MODELS } from "../ai-model-registry.ts";
import { getTokenParameterName } from "../ai-models.ts";

export interface AiRequest {
  model?: string;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export async function callAi(
  payload: AiRequest,
  logger: StructuredLogger,
  supabaseAdmin: any
) {
  const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const model = payload.model || ALLOWED_MODELS.generation;
  const startTime = Date.now();

  logger.info("AI_CALL", `Calling model ${model}`, { model, stream: !!payload.stream });

  const tokenParam = getTokenParameterName(model);
  const normalizedPayload = { ...payload };
  
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
    throw new Error(`AI Gateway error ${res.status}: ${errorText}`);
  }

  // If streaming, return the raw response
  if (payload.stream) {
    return res;
  }

  const data = await res.json();
  
  // Log to ai_governance_logs (non-streaming only for now, or use background job for streaming)
  try {
    await supabaseAdmin.from("ai_governance_logs").insert({
      model_used: model,
      latency_ms: latency,
      token_usage: data.usage || {},
      status: "success",
      metadata: { 
        request: payload,
        response_id: data.id 
      }
    });
  } catch (err) {
    logger.warn("GOVERNANCE_ERROR", "Failed to log AI governance", { error: err.message });
  }

  return data;
}

