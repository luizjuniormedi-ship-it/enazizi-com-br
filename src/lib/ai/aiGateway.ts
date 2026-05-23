
import { rateLimitManager } from './rateLimitManager';
import { supabase } from '@/integrations/supabase/client';

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
  isFallback?: boolean;
  isCached?: boolean;
  provider?: string;
  model?: string;
  retryCount?: number;
}

export class AIGateway {
  private static instance: AIGateway;
  private inflightRequests: Map<string, Promise<AIResponse>> = new Map();
  
  private constructor() {}

  public static getInstance(): AIGateway {
    if (!AIGateway.instance) {
      AIGateway.instance = new AIGateway();
    }
    return AIGateway.instance;
  }

  /**
   * Generates a stable SHA256 hash for a prompt and its parameters.
   */
  private async generateHash(payload: any): Promise<string> {
    const msgUint8 = new TextEncoder().encode(JSON.stringify(payload));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Enterprise-grade invoke with client-side fallback, retry, dedupe and global cache.
   */
  public async invoke(
    functionName: string, 
    body: any, 
    options: { tier?: 'FAST' | 'REASONING', ttlDays?: number } = {}
  ): Promise<AIResponse> {
    const tier = options.tier || 'FAST';
    const payloadHash = await this.generateHash({ functionName, body });

    // 1. DEDUPE (In-flight request registry)
    if (this.inflightRequests.has(payloadHash)) {
      console.log(`[AI_GATEWAY] Deduplicating request: ${payloadHash}`);
      return this.inflightRequests.get(payloadHash)!;
    }

    const requestPromise = this.executeWithResilience(functionName, body, tier, payloadHash, options);
    this.inflightRequests.set(payloadHash, requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.inflightRequests.delete(payloadHash);
    }
  }

  private async executeWithResilience(
    functionName: string, 
    body: any, 
    tier: 'FAST' | 'REASONING',
    payloadHash: string,
    options: { ttlDays?: number }
  ): Promise<AIResponse> {
    // 2. GLOBAL CACHE (Supabase)
    const cachedResult = await this.checkCache(payloadHash);
    if (cachedResult) {
      console.log(`[CACHE_HIT] Result recovered for ${payloadHash}`);
      return {
        success: true,
        data: cachedResult,
        isCached: true
      };
    }
    console.log(`[CACHE_MISS] No cache for ${payloadHash}`);

    const models = rateLimitManager.getRecommendation(tier);
    let lastError = null;
    let fallbackChain: string[] = [];

    // 3. PROVIDER FALLBACK & RETRY
    for (const model of models) {
      const provider = model.split('/')[0];
      fallbackChain.push(model);
      
      for (let retry = 0; retry < 3; retry++) {
        try {
          if (retry > 0) {
            const delay = rateLimitManager.getRetryDelay(retry);
            console.log(`[AI_GATEWAY] Retry ${retry} for ${model} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const startTime = Date.now();
          const { data, error } = await supabase.functions.invoke(functionName, {
            body: { ...body, model }
          });

          const latency = Date.now() - startTime;

          if (error) {
            console.warn(`[AI_GATEWAY] ${model} failed:`, error);
            rateLimitManager.reportFailure(provider, error);
            
            // Log telemetry for failure
            await this.logTelemetry({
              provider,
              model,
              latency,
              error,
              isFallback: model !== models[0],
              retryCount: retry,
              functionName,
              payloadHash
            });

            lastError = error;
            
            // If it's a 429, break retry loop to try fallback provider
            const is429 = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
            if (is429) {
              console.log(`[AIGW_PROVIDER_SWITCH] Switching provider due to quota limit on ${model}`);
              break; 
            }
            continue;
          }

          // SUCCESS
          rateLimitManager.reportSuccess(provider, latency);
          
          // Log telemetry for success
          await this.logTelemetry({
            provider,
            model,
            latency,
            isFallback: model !== models[0],
            retryCount: retry,
            functionName,
            payloadHash
          });

          // Store in global cache
          if (data && data.success !== false) {
            await this.storeCache(payloadHash, functionName, data, options.ttlDays || 7);
          }

          return {
            success: true,
            data,
            isFallback: model !== models[0],
            isCached: false,
            provider,
            model,
            retryCount: retry
          };

        } catch (err: any) {
          console.error(`[AI_GATEWAY] Unexpected error for ${model}:`, err);
          rateLimitManager.reportFailure(provider, err);
          lastError = err;
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || "AI_GATEWAY_ALL_PROVIDERS_FAILED",
      retryCount: 3
    };
  }

  private async checkCache(hash: string) {
    try {
      const { data, error } = await supabase
        .from('ai_gateway_cache')
        .select('content')
        .eq('hash', hash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (error || !data) return null;
      return data.content;
    } catch (e) {
      console.warn("[AI_GATEWAY] Cache check failed", e);
      return null;
    }
  }

  private async storeCache(hash: string, type: string, content: any, ttlDays: number) {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ttlDays);

      await supabase
        .from('ai_gateway_cache')
        .upsert({
          hash,
          prompt_type: type,
          content,
          expires_at: expiresAt.toISOString()
        }, { onConflict: 'hash' });
      
      console.log(`[CACHE_STORE] Result stored for ${hash}`);
    } catch (e) {
      console.warn("[AI_GATEWAY] Cache store failed", e);
    }
  }

  private async logTelemetry(metrics: {
    provider: string,
    model: string,
    latency: number,
    error?: any,
    isFallback: boolean,
    retryCount: number,
    functionName: string,
    payloadHash: string
  }) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      await supabase.from('ai_gateway_metrics').insert({
        provider: metrics.provider,
        model: metrics.model,
        latency_ms: metrics.latency,
        status_code: metrics.error?.status || (metrics.error ? 500 : 200),
        error_message: metrics.error?.message || metrics.error?.toString(),
        is_fallback: metrics.isFallback,
        retry_count: metrics.retryCount,
        user_id: userData?.user?.id,
        function_name: metrics.functionName,
        payload_hash: metrics.payloadHash
      });
    } catch (e) {
      // Non-blocking telemetry
      console.warn("[AI_GATEWAY] Telemetry failed", e);
    }
  }
}

export const aiGateway = AIGateway.getInstance();

