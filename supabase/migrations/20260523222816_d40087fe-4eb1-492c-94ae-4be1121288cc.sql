-- AI Gateway Telemetry
CREATE TABLE IF NOT EXISTS public.ai_gateway_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    latency_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    is_fallback BOOLEAN DEFAULT false,
    is_cache_hit BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id),
    function_name TEXT,
    payload_hash TEXT
);

-- AI Gateway Cache
CREATE TABLE IF NOT EXISTS public.ai_gateway_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    hash TEXT UNIQUE NOT NULL,
    prompt_type TEXT NOT NULL, -- 'mnemonic', 'tutor', 'flashcard'
    content JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Enable RLS
ALTER TABLE public.ai_gateway_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_gateway_cache ENABLE ROW LEVEL SECURITY;

-- Policies for metrics (Insert only for users)
CREATE POLICY "Users can insert their own metrics" 
ON public.ai_gateway_metrics FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Policies for cache (Read for all, Insert for all authenticated)
-- In a real enterprise app, we might want to restrict this more, but for now:
CREATE POLICY "Anyone can read cache" 
ON public.ai_gateway_cache FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert cache" 
ON public.ai_gateway_cache FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_gateway_metrics_created_at ON public.ai_gateway_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_cache_hash ON public.ai_gateway_cache(hash);
CREATE INDEX IF NOT EXISTS idx_ai_gateway_cache_expires_at ON public.ai_gateway_cache(expires_at);
