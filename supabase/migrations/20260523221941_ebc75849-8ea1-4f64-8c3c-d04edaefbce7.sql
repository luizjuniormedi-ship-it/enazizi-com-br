-- 1. AI Provider Metrics
CREATE TABLE IF NOT EXISTS public.ai_provider_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation TEXT,
    latency_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    cost_usd NUMERIC(10, 6),
    status_code INTEGER,
    success BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. AI Provider Failures
CREATE TABLE IF NOT EXISTS public.ai_provider_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    retry_attempt INTEGER DEFAULT 0,
    fallback_model TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. AI Provider Cooldowns
CREATE TABLE IF NOT EXISTS public.ai_provider_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    reason TEXT,
    cooldown_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. AI Global Cache
CREATE TABLE IF NOT EXISTS public.ai_global_cache (
    hash_key TEXT PRIMARY KEY,
    prompt_hash TEXT NOT NULL,
    content JSONB NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_global_cache_prompt_hash ON public.ai_global_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_ai_global_cache_expires_at ON public.ai_global_cache(expires_at);

-- Enable RLS
ALTER TABLE public.ai_provider_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_global_cache ENABLE ROW LEVEL SECURITY;

-- Policies (Admins can view everything, Service role can manage)
CREATE POLICY "Admins can view AI metrics" ON public.ai_provider_metrics FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages AI metrics" ON public.ai_provider_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view AI failures" ON public.ai_provider_failures FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages AI failures" ON public.ai_provider_failures FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view AI cooldowns" ON public.ai_provider_cooldowns FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages AI cooldowns" ON public.ai_provider_cooldowns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read cache" ON public.ai_global_cache FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "Service role manages cache" ON public.ai_global_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
