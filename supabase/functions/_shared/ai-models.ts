import { ALLOWED_MODELS, PRODUCTION_MODELS } from "./ai-model-registry.ts";
import { normalizeModel as normalizeFromShared } from "./model-normalizer.ts";

/**
 * Centralized AI Model Registry
 * Mandatory for all modules.
 */
export const AI_MODELS = {
  FAST: "openai/gpt-5-mini",
  REASONING: "openai/gpt-5",
  CHEAP: "openai/gpt-5-mini",
  FALLBACK: "openai/gpt-5-mini" 
} as const;

export const BLOCKED_MODELS = [
  "google/gemini-1.5-pro",
  "google/gemini-1.5-flash",
];

export const ALLOWED_AI_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5.5",
  "openai/gpt-5.5-pro",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/text-embedding-3-small"
] as const;

/**
 * Returns the correct token parameter name based on the model.
 */
export function getTokenParameterName(model: string): string {
  const isNewModel = /^o[13]/i.test(model) || 
                    model.includes("/o1") || 
                    model.includes("/o3") ||
                    model.includes("gpt-5");
  return isNewModel ? "max_completion_tokens" : "max_tokens";
}

/**
 * Normalizes and validates the model with STRICT blocking of invalid/legacy models.
 */
export function normalizeModelStrict(model?: string): string {
  const DEFAULT = AI_MODELS.FAST;
  
  if (!model) return DEFAULT;

  // Explicitly block legacy/invalid models
  if (BLOCKED_MODELS.includes(model) || model.includes("gemini-2.0")) {
    console.warn("STRICT_MODEL_BLOCK", `Legacy model ${model} blocked and replaced with ${DEFAULT}`);
    return DEFAULT;
  }

  // Check against allowed list
  if (!ALLOWED_AI_MODELS.includes(model as any)) {
    console.warn("STRICT_MODEL_VALIDATION_FAILED", `Model ${model} not in allowed list. Using ${DEFAULT}`);
    return DEFAULT;
  }

  return model;
}

/**
 * Legacy alias for normalizeModelStrict
 */
export function normalizeModel(model?: string) {
  return normalizeModelStrict(model);
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
