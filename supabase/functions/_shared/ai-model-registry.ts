/**
 * AI Model Registry
 * Single source of truth for all AI models used in the ENAZIZI project.
 * Avoid hardcoded strings across the codebase.
 */

export const ALLOWED_MODELS = {
  // Primary model for content generation
  generation: "openai/gpt-5-mini",
  
  // High-performance model for complex reasoning or specialized tasks
  reasoning: "openai/gpt-5",
  
  // Embedding model for vector search
  embeddings: "openai/text-embedding-3-small",
} as const;

export type AiModelType = keyof typeof ALLOWED_MODELS;
export type AiModelName = typeof ALLOWED_MODELS[AiModelType];

// List of strictly allowed production models to prevent injection of experimental/invalid names
export const PRODUCTION_MODELS = [
  "openai/gpt-5-mini",
  "openai/gpt-5",
  "openai/text-embedding-3-small"
];
