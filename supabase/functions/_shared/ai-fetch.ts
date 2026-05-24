
import { getModelForTier, getRecommendedTier, getMaxTokensForTier, type ModelTier } from "./ai-model-tier.ts";
import { aiGatewayManager } from "./ai-gateway-manager.ts";
import { getTokenParameterName } from "./ai-models.ts";
import { logPipelineAlert } from "./pipeline-logger.ts";

const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENAI_API = "https://api.openai.com/v1/chat/completions";

// Retryable status codes (transient errors)
const RETRYABLE_STATUSES = new Set([402, 429, 500, 502, 503, 504]);

interface AiFetchOptions {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  maxRetries?: number;
  timeoutMs?: number;
  maxTokens?: number;
  userId?: string;
  tier?: 'FAST' | 'REASONING';
  skipCache?: boolean;
}

/**
 * Fallback chains for each tier.
 */
const FALLBACK_CHAINS = {
  FAST: [
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash"
  ],
  REASONING: [
    "openai/gpt-4o",
    "google/gemini-2.5-pro",
    "openai/o3-mini"
  ]
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function aiFetch(options: AiFetchOptions): Promise<Response> {
  const source = (Deno.env.get("FUNCTION_NAME") || "unknown-edge-function");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

  // 1. Determine the chain
  const tier = options.tier || 'FAST';
  const chain = options.model ? [options.model, ...FALLBACK_CHAINS[tier]] : FALLBACK_CHAINS[tier];
  
  // 2. Cache Check (only for non-streaming)
  const prompt = options.messages.map(m => m.content).join("\n");
  if (!options.stream && !options.skipCache) {
    const cached = await aiGatewayManager.getFromCache(prompt, chain[0]);
    if (cached) {
      console.log(`[AI_GATEWAY] Cache Hit for prompt hash`);
      return new Response(JSON.stringify(cached), {
        headers: { "Content-Type": "application/json", "X-AI-Cache": "HIT" }
      });
    }
  }

  let lastError: any = null;

  // 3. Iterate through fallback chain
  for (const model of chain) {
    const provider = model.includes('google') ? 'google' : (model.includes('openai') ? 'openai' : 'unknown');
    
    // Check if provider is available (not in cooldown)
    if (!(await aiGatewayManager.isAvailable(provider, model))) {
      console.warn(`[AI_GATEWAY] Skipping ${model} due to active cooldown`);
      continue;
    }

    const maxRetries = provider === 'openai' ? 2 : 1;
    const timeoutMs = provider === 'openai' ? 25000 : 20000;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      try {
        console.log(`[AI_GATEWAY] Attempting ${model} (Attempt ${attempt + 1})`);
        
        const isDirectOpenAI = provider === 'openai' && OPENAI_API_KEY;
        const url = isDirectOpenAI ? OPENAI_API : LOVABLE_GATEWAY;
        const apiKey = isDirectOpenAI ? OPENAI_API_KEY : LOVABLE_API_KEY;
        
        const tokenKey = getTokenParameterName(model);
        const payload = {
          model: model.replace('openai/', '').replace('google/', ''),
          messages: options.messages,
          [tokenKey]: options.maxTokens ?? 16384,
          temperature: 1,
          stream: options.stream,
          response_format: options.response_format,
          tools: options.tools,
          tool_choice: options.tool_choice
        };

        const response = await fetchWithTimeout(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }, timeoutMs);

        const latency = Date.now() - startTime;

        if (response.ok) {
          // Log success metrics
          const dataClone = await response.clone().json();
          await aiGatewayManager.logMetric({
            provider,
            model,
            operation: source,
            latency_ms: latency,
            prompt_tokens: dataClone.usage?.prompt_tokens,
            completion_tokens: dataClone.usage?.completion_tokens,
            success: true,
            status_code: response.status
          });

          // Cache result if applicable
          if (!options.stream) {
            await aiGatewayManager.setCache(prompt, model, provider, dataClone);
          }

          return response;
        }

        // Handle error
        const errBody = await response.text();
        console.warn(`[AI_GATEWAY] ${model} failed with ${response.status}: ${errBody.slice(0, 100)}`);
        
        await aiGatewayManager.logFailure({
          provider,
          model,
          error_code: String(response.status),
          error_message: errBody,
          fallback_model: chain[chain.indexOf(model) + 1]
        });

        if (!RETRYABLE_STATUSES.has(response.status)) {
          // Non-retryable error, move to next model in chain
          break;
        }

        // If it's 429, we might want to skip further retries for THIS model and move to next
        if (response.status === 429) {
          break;
        }

      } catch (err) {
        console.error(`[AI_GATEWAY] Exception with ${model}:`, err);
        lastError = err;
      }

      // Exponential backoff for retries
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    console.warn(`[AI_GATEWAY] Moving to fallback after ${model} failed`);
  }

  // If we reach here, everything failed
  throw lastError || new Error("AI_SERVICE_UNAVAILABLE_ALL_PROVIDERS");
}

export function getAiErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) return "Alta demanda detectada. Nossos sistemas estão escalando.";
  return "Serviço de IA temporariamente indisponível. Fallback em andamento.";
}
