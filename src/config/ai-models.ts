/**
 * Centralized AI Model Registry for Frontend
 * Synchronized with Edge Functions registry.
 */

export const AI_MODELS = {
  FAST: "google/gemini-2.5-flash",
  REASONING: "google/gemini-2.5-pro",
  CHEAP: "google/gemini-2.5-flash-lite",
  FALLBACK: "openai/gpt-5.5"
} as const;

/**
 * Validates if a model name is allowed.
 */
export function validateModel(model: string): boolean {
  const allowedModels = [
    "google/gemini-2.5-flash",
    "google/gemini-2.5-pro",
    "google/gemini-2.5-flash-lite",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/gpt-5.5",
    "openai/gpt-5.5-pro",
    "openai/gpt-5.4-mini",
    "openai/text-embedding-3-small"
  ];
  
  return allowedModels.includes(model);
}

/**
 * Returns the correct token parameter name based on the model.
 */
export function getTokenParameterName(model: string): "max_tokens" | "max_completion_tokens" {
  const isReasoningModel = /^o[13]/i.test(model) || 
                          model.includes("/o1") || 
                          model.includes("/o3") ||
                          model.includes("gpt-5");
  return isReasoningModel ? "max_completion_tokens" : "max_tokens";
}

export type AIModelKey = keyof typeof AI_MODELS;
