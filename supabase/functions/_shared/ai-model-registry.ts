/**
 * AI Model Registry
 * Single source of truth for all AI models used in the ENAZIZI project.
 * Updated to use confirmed stable models for Lovable AI Gateway (2026-05-17).
 */

export const ALLOWED_MODELS = {
  // Primary model for content generation
  generation: "google/gemini-2.5-flash",
  
  // High-performance model for complex reasoning or specialized tasks
  reasoning: "google/gemini-2.5-pro",
  
  // Embedding model for vector search
  embeddings: "openai/text-embedding-3-small",
} as const;

export const DEFAULT_FAST_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_REASONING_MODEL = "google/gemini-2.5-pro";

// AI Tiers and Pricing (Est. USD per 1M tokens)
export const MODEL_METRICS: Record<string, { prompt: number, completion: number, quality: number }> = {
  "google/gemini-2.5-flash": { prompt: 0.075, completion: 0.3, quality: 85 },
  "google/gemini-2.5-pro": { prompt: 3.5, completion: 10.5, quality: 98 },
  "google/gemini-2.5-flash-lite": { prompt: 0.05, completion: 0.1, quality: 78 },
  "openai/gpt-4o": { prompt: 5.0, completion: 15.0, quality: 96 },
  "openai/gpt-4o-mini": { prompt: 0.15, completion: 0.6, quality: 82 },
  "openai/gpt-5.5": { prompt: 10.0, completion: 30.0, quality: 100 },
  "openai/gpt-5.5-pro": { prompt: 15.0, completion: 45.0, quality: 100 },
  "openai/gpt-5.4-mini": { prompt: 0.5, completion: 1.5, quality: 90 },
};

export type AiModelType = keyof typeof ALLOWED_MODELS;
export type AiModelName = typeof ALLOWED_MODELS[AiModelType];

// List of strictly allowed production models for Lovable AI Gateway
export const PRODUCTION_MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/gpt-5.5",
  "openai/gpt-5.5-pro",
  "openai/gpt-5.4-mini",
  "openai/text-embedding-3-small",
];
