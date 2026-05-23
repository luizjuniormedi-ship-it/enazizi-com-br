
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export interface ProviderState {
  provider: string;
  model: string;
  status: 'online' | 'cooldown' | 'exhausted';
  cooldownUntil: Date | null;
}

export class AIGatewayManager {
  private static instance: AIGatewayManager;
  
  private constructor() {}

  public static getInstance(): AIGatewayManager {
    if (!AIGatewayManager.instance) {
      AIGatewayManager.instance = new AIGatewayManager();
    }
    return AIGatewayManager.instance;
  }

  /**
   * Logs a metric to the database for observability.
   */
  public async logMetric(data: {
    provider: string;
    model: string;
    operation: string;
    latency_ms: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    success: boolean;
    status_code?: number;
  }) {
    await supabase.from('ai_provider_metrics').insert([{
      ...data,
      cost_usd: this.calculateCost(data.model, data.prompt_tokens || 0, data.completion_tokens || 0)
    }]);
  }

  /**
   * Logs a failure and checks if a cooldown should be triggered.
   */
  public async logFailure(data: {
    provider: string;
    model: string;
    error_code: string;
    error_message: string;
    fallback_model?: string;
  }) {
    await supabase.from('ai_provider_failures').insert([data]);

    if (data.error_code === '429' || data.error_message.includes('RESOURCE_EXHAUSTED')) {
      await this.triggerCooldown(data.provider, data.model, 'Rate limit exceeded (429)');
    }
  }

  private async triggerCooldown(provider: string, model: string, reason: string) {
    const cooldownUntil = new Date(Date.now() + 60 * 1000); // 1 minute cooldown
    await supabase.from('ai_provider_cooldowns').insert([{
      provider,
      model,
      reason,
      cooldown_until: cooldownUntil.toISOString()
    }]);
    console.warn(`[AI_GATEWAY_MANAGER] Cooldown triggered for ${provider}/${model} until ${cooldownUntil.toISOString()}`);
  }

  public async isAvailable(provider: string, model: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('ai_provider_cooldowns')
      .select('cooldown_until')
      .eq('provider', provider)
      .eq('model', model)
      .gt('cooldown_until', new Date().toISOString())
      .limit(1);

    if (error) return true;
    return data.length === 0;
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    // Simplified cost calculation
    const rates: Record<string, { p: number; c: number }> = {
      'gemini-2.5-flash-lite': { p: 0.0000001, c: 0.0000003 },
      'gemini-2.5-flash': { p: 0.0000003, c: 0.0000009 },
      'gemini-2.5-pro': { p: 0.0000035, c: 0.0000105 },
      'gpt-4o-mini': { p: 0.00000015, c: 0.0000006 },
    };
    const rate = rates[model] || { p: 0, c: 0 };
    return (promptTokens * rate.p) + (completionTokens * rate.c);
  }

  /**
   * Global prompt cache implementation
   */
  public async getFromCache(prompt: string, model: string): Promise<any | null> {
    const hash = await this.hashPrompt(prompt);
    const { data, error } = await supabase
      .from('ai_global_cache')
      .select('content')
      .eq('prompt_hash', hash)
      .eq('model', model)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .single();

    if (error) return null;
    return data?.content;
  }

  public async setCache(prompt: string, model: string, provider: string, content: any, ttlSeconds: number = 3600) {
    const hash = await this.hashPrompt(prompt);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    await supabase.from('ai_global_cache').upsert([{
      hash_key: `${model}:${hash}`,
      prompt_hash: hash,
      content,
      model,
      provider,
      expires_at: expiresAt.toISOString()
    }]);
  }

  private async hashPrompt(prompt: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(prompt);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
}

export const aiGatewayManager = AIGatewayManager.getInstance();
