/**
 * AI Model Registry — ENAZIZI ENTERPRISE v10 (OpenAI Priority)
 */

export const ALLOWED_MODELS = {
  // Primary models (Lovable Gateway Priority)
  generation: "openai/gpt-4o-mini",
  reasoning: "openai/gpt-4o", 
  
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
  "openai/gpt-4o": { prompt: 2.5, completion: 10.0, quality: 96 },
  "google/gemini-2.5-flash": { prompt: 0.075, completion: 0.3, quality: 85 },
  "google/gemini-2.5-pro": { prompt: 3.5, completion: 10.5, quality: 98 },
};

export const PRODUCTION_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4.1", 
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "openai/text-embedding-3-small",
];

/* ------------------------------------------------------------------ */
/* NVIDIA (OPT-IN — registrado, NÃO ativo em nenhum módulo)            */
/* Fonte única de capability metadata para o futuro AI Router.         */
/* Ativação depende do secret NVIDIA_API_KEY + healthcheck WORKING.    */
/* ------------------------------------------------------------------ */
export const NVIDIA_PROVIDER_META = {
  provider: "nvidia",
  enabled: false, // ativado somente após healthcheck real aprovado
  baseUrlEnv: "NVIDIA_BASE_URL",
  apiKeyEnv: "NVIDIA_API_KEY",
  defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
  models: {
    fast: { id: "meta/llama-3.1-8b-instruct", tier: "FAST", vision: false, reasoning: false },
    reasoning: { id: "meta/llama-3.3-70b-instruct", tier: "REASONING", vision: false, reasoning: true },
  },
} as const;

/* ------------------------------------------------------------------ */
/* CEREBRAS (OPT-IN — registrado, NÃO ativo em nenhum módulo)           */
/* ------------------------------------------------------------------ */
export const CEREBRAS_PROVIDER_META = {
  provider: "cerebras",
  enabled: false,
  baseUrlEnv: "CEREBRAS_BASE_URL",
  apiKeyEnv: "CEREBRAS_API_KEY",
  defaultBaseUrl: "https://api.cerebras.ai/v1",
  models: {
    fast: { id: "llama3.1-8b", tier: "FAST", vision: false, reasoning: false },
    reasoning: { id: "llama3.1-70b", tier: "REASONING", vision: false, reasoning: true },
    clinical_arena: { id: "gpt-oss-120b", tier: "ARENA", vision: false, reasoning: true },
    glm_reasoning: { id: "zai-glm-4.7", tier: "REASONING", vision: false, reasoning: true },
  },
} as const;
