/**
 * Centralized AI Model Registry for Frontend
 * Synchronized with Edge Functions registry.
 */

export const AI_MODELS = {
  generation: "openai/gpt-5-mini",
  extraction: "openai/gpt-5-mini",
  reasoning: "openai/gpt-5",
  embeddings: "text-embedding-3-small",
} as const;

export type AIModelKey = keyof typeof AI_MODELS;

/**
 * Validates if a model name is allowed.
 */
export function validateModel(model: string): boolean {
  const allowedPrefixes = ["openai/gpt-5", "gpt-3.5", "o1-", "o3-", "text-embedding-"];
  const isAllowed = allowedPrefixes.some(prefix => model.startsWith(prefix)) || 
                    Object.values(AI_MODELS).includes(model as any);
  
  return isAllowed;
}

/**
 * Returns the correct token parameter name based on the model.
 */
export function getTokenParameterName(model: string): "max_tokens" | "max_completion_tokens" {
  const isReasoningModel = /^o[13]/i.test(model) || model.includes("/o1") || model.includes("/o3");
  return isReasoningModel ? "max_completion_tokens" : "max_tokens";
}
