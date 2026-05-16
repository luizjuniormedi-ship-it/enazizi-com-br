import { ALLOWED_MODELS } from "./ai-model-registry.ts";
import { normalizeModel } from "./model-normalizer.ts";

/**
 * Centralized AI Model Registry
 * Updated to use the new unified registry.
 */
export const AI_MODELS = {
  generation: ALLOWED_MODELS.generation,
  extraction: ALLOWED_MODELS.generation,
  reasoning: ALLOWED_MODELS.reasoning,
  embeddings: ALLOWED_MODELS.embeddings,
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

/**
 * Validates if a model name is allowed.
 * Now uses the normalizer to ensure consistency.
 */
export function validateModel(model: string): boolean {
  try {
    const normalized = normalizeModel(model);
    return !!normalized;
  } catch {
    return false;
  }
}

/**
 * Returns the correct token parameter name based on the model.
 * Only o1/o3 and specific new generation models use 'max_completion_tokens'.
 */
export function getTokenParameterName(model: string): string {
  const isNewModel = /^o[13]/i.test(model) || 
                    model.includes("/o1") || 
                    model.includes("/o3");
  return isNewModel ? "max_completion_tokens" : "max_tokens";
}

/**
 * Standardizes model names.
 */
export function standardizeModelName(model: string): string {
  const normalized = normalizeModel(model);
  if (normalized.startsWith("gpt-") || normalized.startsWith("o1-") || normalized.startsWith("o3-") || normalized.startsWith("text-embedding-")) {
    return `openai/${normalized}`;
  }
  return normalized;
}
