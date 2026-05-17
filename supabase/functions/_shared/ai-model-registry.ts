/**
 * AI Model Registry
 * Single source of truth for all AI models used in the ENAZIZI project.
 * Updated to use confirmed stable models for Lovable AI Gateway.
 */

export const ALLOWED_MODELS = {
  // Primary model for content generation
  generation: "google/gemini-2.0-flash", // Using 2.0 as stable base until 2.5 is verified
  
  // High-performance model for complex reasoning or specialized tasks
  reasoning: "openai/gpt-4o",
  
  // Embedding model for vector search
  embeddings: "openai/text-embedding-3-small",
} as const;

export const DEFAULT_FAST_MODEL = "google/gemini-2.0-flash";
export const DEFAULT_REASONING_MODEL = "openai/gpt-4o";

export type AiModelType = keyof typeof ALLOWED_MODELS;
export type AiModelName = typeof ALLOWED_MODELS[AiModelType];

// List of strictly allowed production models to prevent injection
export const PRODUCTION_MODELS = [
  "google/gemini-2.0-flash",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/text-embedding-3-small",
  "google/gemini-flash-1.5",
  "google/gemini-pro-1.5"
];
