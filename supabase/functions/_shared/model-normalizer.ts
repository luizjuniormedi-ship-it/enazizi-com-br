import { ALLOWED_MODELS, PRODUCTION_MODELS } from "./ai-model-registry.ts";
import { logPipelineAlert } from "./pipeline-logger.ts";

/**
 * ENAZIZI ENTERPRISE — AI Model Normalizer
 * Standardizes AI model names and prevents invalid variants from breaking the pipeline.
 */

export function normalizeModel(model: string | null | undefined): string {
  if (!model) return "google/gemini-2.0-flash";

  let normalized = model.toLowerCase().trim();

  // Map legacy or shorthand names to enterprise standards
  if (normalized.includes("gpt-5")) {
    // GPT-5 is not yet stable in this environment, fallback to high-quality gpt-4o
    return "openai/gpt-4o";
  }

  if (normalized.includes("gpt-4o-mini")) return "openai/gpt-4o-mini";
  if (normalized.includes("gpt-4o")) return "openai/gpt-4o";
  if (normalized.includes("gemini-2.0-flash")) return "google/gemini-2.0-flash";
  if (normalized.includes("gemini-2.5") || normalized.includes("gemini-3")) {
    return "google/gemini-2.0-flash"; // Fallback to stable 2.0
  }

  // Ensure prefix for known providers
  if (normalized.startsWith("gpt-") || normalized.startsWith("o1-") || normalized.startsWith("o3-")) {
    return `openai/${normalized}`;
  }
  
  if (normalized.startsWith("gemini-")) {
    return `google/${normalized}`;
  }

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
