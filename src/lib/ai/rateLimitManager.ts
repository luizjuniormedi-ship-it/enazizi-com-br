
/**
 * ENAZIZI AI Rate Limit Manager
 * Monitors quotas, handles cooldowns, and manages provider health.
 */

export type ProviderStatus = 'online' | 'degraded' | 'exhausted' | 'cooldown';

interface ProviderState {
  status: ProviderStatus;
  cooldownUntil: number | null;
  errorRate: number;
  last429: number | null;
  rollingLatency: number[];
  failureCount: number;
}

class RateLimitManager {
  private static instance: RateLimitManager;
  private providerStates: Map<string, ProviderState> = new Map();
  private readonly FAILURE_THRESHOLD = 5;
  private readonly COOLDOWN_DURATION = 60000; // 1 minute default
  private readonly MAX_LATENCY_HISTORY = 10;

  private constructor() {}

  public static getInstance(): RateLimitManager {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager();
    }
    return RateLimitManager.instance;
  }

  private getInitialState(): ProviderState {
    return {
      status: 'online',
      cooldownUntil: null,
      errorRate: 0,
      last429: null,
      rollingLatency: [],
      failureCount: 0
    };
  }

  public getProviderState(provider: string): ProviderState {
    if (!this.providerStates.has(provider)) {
      this.providerStates.set(provider, this.getInitialState());
    }
    const state = this.providerStates.get(provider)!;
    
    // Check if cooldown expired
    if (state.status === 'cooldown' && state.cooldownUntil && Date.now() > state.cooldownUntil) {
      state.status = 'online';
      state.cooldownUntil = null;
      state.failureCount = 0;
    }
    
    return state;
  }

  public reportSuccess(provider: string, latency: number) {
    const state = this.getProviderState(provider);
    state.status = 'online';
    state.failureCount = 0;
    state.rollingLatency.push(latency);
    if (state.rollingLatency.length > this.MAX_LATENCY_HISTORY) {
      state.rollingLatency.shift();
    }
    state.errorRate = Math.max(0, state.errorRate - 0.1);
  }

  public reportFailure(provider: string, error: any) {
    const state = this.getProviderState(provider);
    const is429 = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
    
    state.failureCount++;
    state.errorRate = Math.min(1, state.errorRate + 0.2);

    if (is429) {
      state.last429 = Date.now();
      state.status = 'exhausted';
      this.setCooldown(provider, 30000); // 30s for 429
    } else if (state.failureCount >= this.FAILURE_THRESHOLD) {
      state.status = 'cooldown';
      this.setCooldown(provider, this.COOLDOWN_DURATION);
    }
  }

  private setCooldown(provider: string, duration: number) {
    const state = this.getProviderState(provider);
    state.status = 'cooldown';
    state.cooldownUntil = Date.now() + duration;
    console.warn(`[AI_GATEWAY] Provider ${provider} entering cooldown until ${new Date(state.cooldownUntil).toISOString()}`);
  }

  public isAvailable(provider: string): boolean {
    const state = this.getProviderState(provider);
    return state.status === 'online' || state.status === 'degraded';
  }

  public getRecommendation(tier: 'FAST' | 'REASONING'): string[] {
    const priorities = {
      FAST: ['google/gemini-2.5-flash-lite', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini'],
      REASONING: ['google/gemini-2.5-pro', 'openai/o3-mini', 'openai/gpt-4o']
    };

    return priorities[tier].filter(model => {
      const provider = model.split('/')[0];
      return this.isAvailable(provider);
    });
  }
}

export const rateLimitManager = RateLimitManager.getInstance();
