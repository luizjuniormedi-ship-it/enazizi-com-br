import { ALLOWED_MODELS, PRODUCTION_MODELS } from "./ai-model-registry.ts";
import { normalizeModel as normalizeFromShared } from "./model-normalizer.ts";

/**
 * Centralized AI Model Registry
 * Mandatory for all modules.
 */
export const AI_MODELS = {
  FAST: "google/gemini-2.5-flash",
  REASONING: "google/gemini-2.5-pro",
  CHEAP: "google/gemini-2.5-flash-lite",
  FALLBACK: "openai/gpt-5.5"
} as const;

/**
 * Returns the correct token parameter name based on the model.
 * Only o1/o3 and specific new generation models use 'max_completion_tokens'.
 */
export function getTokenParameterName(model: string): string {
  const isNewModel = /^o[13]/i.test(model) || 
                    model.includes("/o1") || 
                    model.includes("/o3") ||
                    model.includes("gpt-5"); // Assuming gpt-5 uses new params
  return isNewModel ? "max_completion_tokens" : "max_tokens";
}

/**
 * Normalizes and validates the model.
 */
export function normalizeModel(model?: string) {
  const allowed = PRODUCTION_MODELS;

  if (!model || !allowed.includes(model as any)) {
    console.warn("Invalid AI model requested, falling back", {
      requested: model,
      fallback: AI_MODELS.FAST
    });

    return AI_MODELS.FAST;
  }

  return model;
}

/**
 * Standardizes model names.
 */
export function standardizeModelName(model: string): string {
  const normalized = normalizeFromShared(model);
  if (normalized.startsWith("gpt-") || normalized.startsWith("o1-") || normalized.startsWith("o3-") || normalized.startsWith("text-embedding-")) {
    return `openai/${normalized}`;
  }
  return normalized;
}

export type AIModelKey = keyof typeof AI_MODELS;
