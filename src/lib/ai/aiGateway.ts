
import { rateLimitManager } from './rateLimitManager';
import { supabase } from '@/integrations/supabase/client';

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
  isFallback?: boolean;
  isCached?: boolean;
}

export class AIGateway {
  private static instance: AIGateway;
  
  private constructor() {}

  public static getInstance(): AIGateway {
    if (!AIGateway.instance) {
      AIGateway.instance = new AIGateway();
    }
    return AIGateway.instance;
  }

  /**
   * Enterprise-grade invoke with client-side fallback and retry.
   */
  public async invoke(functionName: string, body: any, options: { tier?: 'FAST' | 'REASONING' } = {}): Promise<AIResponse> {
    const tier = options.tier || 'FAST';
    const models = rateLimitManager.getRecommendation(tier);
    
    let lastError = null;

    // Try models in order of priority
    for (const model of models) {
      const provider = model.split('/')[0];
      
      try {
        const startTime = Date.now();
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { ...body, model }
        });

        const latency = Date.now() - startTime;

        if (error) {
          rateLimitManager.reportFailure(provider, error);
          lastError = error;
          continue;
        }

        rateLimitManager.reportSuccess(provider, latency);
        
        return {
          success: true,
          data,
          isFallback: model !== models[0],
          isCached: data?.cached || false
        };

      } catch (err) {
        rateLimitManager.reportFailure(provider, err);
        lastError = err;
      }
    }

    return {
      success: false,
      error: lastError?.message || "AI_GATEWAY_ALL_PROVIDERS_FAILED"
    };
  }
}

export const aiGateway = AIGateway.getInstance();
