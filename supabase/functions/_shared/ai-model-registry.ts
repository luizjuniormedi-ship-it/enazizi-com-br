/**
 * AI Model Registry
 * Single source of truth for all AI models used in the ENAZIZI project.
 * Avoid hardcoded strings across the codebase.
 */

export const ALLOWED_MODELS = {
  // Primary model for content generation
  generation: "gpt-5-mini",
  
  // High-performance model for complex reasoning or specialized tasks
  reasoning: "gpt-5",
  
  // Embedding model for vector search
  embeddings: "text-embedding-3-small",
} as const;

export type AiModelType = keyof typeof ALLOWED_MODELS;
export type AiModelName = typeof ALLOWED_MODELS[AiModelType];

// List of strictly allowed production models to prevent injection of experimental/invalid names
export const PRODUCTION_MODELS = [
  "gpt-5-mini",
  "gpt-5",
  "text-embedding-3-small"
];
