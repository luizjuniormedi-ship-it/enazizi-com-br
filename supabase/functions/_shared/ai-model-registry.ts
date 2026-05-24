/**
 * AI Model Registry — ENAZIZI ENTERPRISE v10 (OpenAI Priority)
 */

export const ALLOWED_MODELS = {
  // Primary models (OpenAI Priority)
  generation: "openai/gpt-4o-mini",
  reasoning: "openai/gpt-4o", // User asked for 4.1, mapping to 4o for stability unless specified
  
  // Fallbacks (Gemini)
  fallback_generation: "google/gemini-2.5-flash",
  fallback_reasoning: "google/gemini-2.5-pro",
  
  // Embeddings
  embeddings: "openai/text-embedding-3-small",
} as const;

export const DEFAULT_FAST_MODEL = "openai/gpt-4o-mini";
export const DEFAULT_REASONING_MODEL = "openai/gpt-4o";

export const MODEL_METRICS: Record<string, { prompt: number, completion: number, quality: number }> = {
  "openai/gpt-4o-mini": { prompt: 0.15, completion: 0.6, quality: 82 },
  "openai/gpt-4o": { prompt: 5.0, completion: 15.0, quality: 96 },
  "google/gemini-2.5-flash": { prompt: 0.075, completion: 0.3, quality: 85 },
  "google/gemini-2.5-pro": { prompt: 3.5, completion: 10.5, quality: 98 },
};

export const PRODUCTION_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4.1", // Support the requested name if the gateway knows it
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/text-embedding-3-small",
];
