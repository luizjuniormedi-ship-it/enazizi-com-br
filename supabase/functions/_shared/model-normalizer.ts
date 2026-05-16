import { ALLOWED_MODELS, PRODUCTION_MODELS } from "./ai-model-registry.ts";
import { logPipelineAlert } from "./pipeline-logger.ts";

/**
 * Normalizes any model string into a strictly supported version.
 * Prevents "openai/gpt-5-mini", "gpt-5-mini" and other invalid variants from breaking the pipeline.
 */
export function normalizeModel(model: string | null | undefined): string {
  if (!model) {
    return ALLOWED_MODELS.generation;
  }

  const rawModel = model.toLowerCase().trim();

  // Rule 1: Fix legacy "openai/" prefix if needed, but registry now uses full names
  let normalized = rawModel;
  
  // Backward compatibility: if someone asks for "gpt-5-mini" without prefix, fix it
  if (normalized === "gpt-5-mini") normalized = "openai/gpt-5-mini";
  if (normalized === "gpt-5") normalized = "openai/gpt-5";
  if (normalized === "text-embedding-3-small") normalized = "openai/text-embedding-3-small";

  // Rule 2: Strict check against production models
  if (PRODUCTION_MODELS.includes(normalized)) {
    return normalized;
  }

  // Rule 4: Fallback for any unknown model
  const source = Deno.env.get("FUNCTION_NAME") || "model-normalizer";
  console.error(`[CRITICAL_MODEL_ERROR] Unknown model detected: "${model}". Falling back to ${ALLOWED_MODELS.generation}`);
  
  // Log critical alert for unknown models
  logPipelineAlert({
    source,
    message: `Invalid AI model requested: ${model}`,
    severity: "critical",
    alert_type: "validation_error",
    model_used: model,
    metadata: {
      originalModel: model,
      normalizedAttempt: normalized,
      fallbackTo: ALLOWED_MODELS.generation
    }
  }).catch(err => console.error("Failed to log pipeline alert:", err));

  return ALLOWED_MODELS.generation;
}

/**
 * Validates the full payload before sending it to the AI Gateway.
 */
export function validatePayload(payload: any): { valid: boolean; error?: string } {
  if (!payload.model) return { valid: false, error: "Missing model" };
  if (!payload.messages || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return { valid: false, error: "Missing or empty messages" };
  }
  
  // Check for empty content in messages
  for (const msg of payload.messages) {
    if (!msg.content && !msg.tool_calls) {
      return { valid: false, error: "Message content cannot be empty" };
    }
  }

  return { valid: true };
}
