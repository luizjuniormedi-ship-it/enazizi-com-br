
/**
 * ENAZIZI — Frontend AI Router v10 (OpenAI Priority)
 * Universal logic for AI execution with client-side fallback and resilience.
 */

import { supabase } from "@/integrations/supabase/client";

export type AIStatus = 'loading' | 'primary' | 'fallback' | 'retry' | 'cache' | 'fatal' | 'success' | 'static';

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  provider?: string;
  isCached?: boolean;
  isStatic?: boolean;
}

async function generateSHA256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AIRouter {
  private static instance: AIRouter;
  private inflight: Map<string, Promise<AIResponse>> = new Map();

  private constructor() {}

  public static getInstance(): AIRouter {
    if (!AIRouter.instance) AIRouter.instance = new AIRouter();
    return AIRouter.instance;
  }

  /**
   * Executes a safe AI request with multiple layers of protection.
   */
  public async execute<T = any>(
    functionName: string,
    payload: any,
    options: {
      tier?: 'FAST' | 'REASONING';
      onStatus?: (status: AIStatus) => void;
      skipCache?: boolean;
    } = {}
  ): Promise<AIResponse<T>> {
    const { tier = 'FAST', onStatus } = options;
    
    // 1. Identification
    const user = (await supabase.auth.getUser()).data.user;
    const cacheKey = await generateSHA256(`${JSON.stringify(payload)}_${tier}_${user?.id || 'system'}`);

    // 2. In-flight Deduplication
    if (this.inflight.has(cacheKey)) {
      console.log(`[DEDUPE] Request already in flight: ${cacheKey.substring(0, 8)}`);
      return this.inflight.get(cacheKey) as Promise<AIResponse<T>>;
    }

    const promise = (async (): Promise<AIResponse<T>> => {
      try {
        onStatus?.('loading');

        // 3. Cache Check
        if (!options.skipCache) {
          const { data: cached } = await supabase
            .from("ai_gateway_cache")
            .select("content")
            .eq("hash", cacheKey)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();

          if (cached) {
            console.log(`[CACHE_HIT] ${cacheKey.substring(0, 8)}`);
            onStatus?.('cache');
            return { success: true, data: cached.content, isCached: true };
          }
        }

        // 4. Remote Execution (with Backend Fallback Order v10)
        onStatus?.('primary');
        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { ...payload, tier, userId: user?.id }
        });

        if (error) {
          console.warn(`[ROUTER_REMOTE_FAIL] ${functionName}`, error);
          // The edge function already tries its own fallback chain (OpenAI -> Gemini)
          // If it still fails, we check for static fallback
          return this.handleCriticalFailure(payload, error.message, onStatus);
        }

        onStatus?.('success');
        return { success: true, data, provider: data?.provider || 'unknown' };

      } catch (err: any) {
        return this.handleCriticalFailure(payload, err.message, onStatus);
      }
    })();

    this.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  private handleCriticalFailure(payload: any, message: string, onStatus?: (status: AIStatus) => void): AIResponse {
    console.error(`[CRITICAL_AI_FAILURE] ${message}`);
    onStatus?.('static');
    
    // Static Fallback Logic (Matching mission v10 requirement 7)
    const tema = payload.tema || payload.topic || "Geral";
    const staticData = this.getStaticFallback(tema);
    
    return {
      success: true,
      data: staticData,
      isStatic: true,
      error: message
    };
  }

  private getStaticFallback(tema: string) {
    if (tema.includes("Light")) {
      return {
        sigla: "LUZ",
        frase_mnemonica: "A LUZ ilumina os critérios de Light.",
        explicacao_didatica: "Proteína > 0.5, LDH > 0.6.",
        cena_visual: "Um farol no meio do mar."
      };
    }
    return {
      sigla: "FIX",
      frase_mnemonica: `Focar no essencial de ${tema}.`,
      explicacao_didatica: "O sistema de IA está passando por instabilidade momentânea.",
      cena_visual: "Um livro aberto com uma luz dourada."
    };
  }
}

export const aiRouter = AIRouter.getInstance();
