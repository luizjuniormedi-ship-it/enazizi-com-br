/**
 * Centralized AI Model Registry
 * To be used by all Edge Functions to avoid hardcoded model names and incompatible parameters.
 */

export const AI_MODELS = {
  generation: "gpt-5-mini",
  extraction: "gpt-5-mini",
  reasoning: "gpt-5",
  embeddings: "text-embedding-3-small",
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

/**
 * Validates if a model name is allowed and exists in our registry or is a known valid model.
 */
export function validateModel(model: string): boolean {
  const allowedPrefixes = ["gpt-5", "gpt-4o", "gpt-3.5", "o1-", "o3-", "text-embedding-"];
  const isAllowed = allowedPrefixes.some(prefix => model.startsWith(prefix)) || 
                    Object.values(AI_MODELS).includes(model as any);
  
  if (!isAllowed) {
    console.error(`[ModelValidator] Model "${model}" is not in the allowed list.`);
  }
  return isAllowed;
}

/**
 * Returns the correct token parameter name based on the model.
 * Reasoning models (o1, o3) use 'max_completion_tokens'.
 * Standard models use 'max_tokens'.
 */
export function getTokenParameterName(model: string): string {
  const isReasoningModel = /^o[13]/i.test(model) || model.includes("/o1") || model.includes("/o3");
  return isReasoningModel ? "max_completion_tokens" : "max_tokens";
}

/**
 * Standardizes model names to include provider prefix for Lovable Gateway if missing.
 */
export function standardizeModelName(model: string): string {
  if (model.startsWith("gpt-") || model.startsWith("o1-") || model.startsWith("o3-") || model.startsWith("text-embedding-") || model.startsWith("gpt-5")) {
    return `openai/${model}`;
  }
  return model;
}
