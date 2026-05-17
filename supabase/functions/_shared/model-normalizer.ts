import { ALLOWED_MODELS, PRODUCTION_MODELS } from "./ai-model-registry.ts";
import { logPipelineAlert } from "./pipeline-logger.ts";

/**
 * ENAZIZI ENTERPRISE — AI Model Normalizer
 * Standardizes AI model names and prevents invalid variants from breaking the pipeline.
 */

export function normalizeModel(model: string | null | undefined): string {
  const source = Deno.env.get("FUNCTION_NAME") || "model-normalizer";
  
  if (!model) return ALLOWED_MODELS.generation;

  let normalized = model.toLowerCase().trim();

  // Map legacy or shorthand names to enterprise standards
  if (normalized.includes("gpt-5") || normalized.includes("gpt-5-mini")) {
    console.warn(`[MODEL_NORMALIZER] GPT-5 detected and rejected due to Gateway Error 400. Falling back to ${ALLOWED_MODELS.generation}`);
    return ALLOWED_MODELS.generation;
  }

  if (normalized.includes("gpt-4o-mini")) return "openai/gpt-4o-mini";
  if (normalized.includes("gpt-4o")) return "openai/gpt-4o";
  if (normalized.includes("gemini-2.0-flash")) return "google/gemini-2.0-flash";
  if (normalized.includes("gemini-1.5-flash")) return "google/gemini-flash-1.5";
  if (normalized.includes("gemini-1.5-pro")) return "google/gemini-pro-1.5";

  // Check if it's in our production whitelist
  if (PRODUCTION_MODELS.includes(normalized)) return normalized;
  
  // Try adding provider prefix if missing
  if (normalized.startsWith("gpt-") || normalized.startsWith("o1-") || normalized.startsWith("o3-")) {
    const withPrefix = `openai/${normalized}`;
    if (PRODUCTION_MODELS.includes(withPrefix)) return withPrefix;
  }
  
  if (normalized.startsWith("gemini-")) {
    const withPrefix = `google/${normalized}`;
    if (PRODUCTION_MODELS.includes(withPrefix)) return withPrefix;
  }

  // Final validation against PRODUCTION_MODELS
  if (!PRODUCTION_MODELS.includes(normalized)) {
    console.error(`[CRITICAL_MODEL_ERROR] Unknown or invalid model: "${model}". Falling back to ${ALLOWED_MODELS.generation}`);
    
    // Log critical alert for unknown models
    logPipelineAlert({
      source,
      message: `Invalid AI model replaced: ${model}`,
      severity: "critical",
      alert_type: "validation_error",
      model_used: model,
      metadata: {
        originalModel: model,
        normalizedAttempt: normalized,
        fallbackTo: ALLOWED_MODELS.generation,
        reason: "Model rejected by Gateway or not in whitelist"
      }
    }).catch(err => console.error("Failed to log pipeline alert:", err));

    return ALLOWED_MODELS.generation;
  }

  return normalized;
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
