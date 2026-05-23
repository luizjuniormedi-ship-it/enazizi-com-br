-- Table for AI Provider Circuits
CREATE TABLE IF NOT EXISTS public.ai_provider_circuits (
    provider TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'CLOSED',
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for Global Request Lock (Inflight)
CREATE TABLE IF NOT EXISTS public.ai_inflight_requests (
    lock_key TEXT PRIMARY KEY,
    result_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_provider_circuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_inflight_requests ENABLE ROW LEVEL SECURITY;

-- Policies (Service Role can always access everything, but let's add some basic policies)
CREATE POLICY "Allow all for authenticated users (read)" ON public.ai_provider_circuits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated users (read)" ON public.ai_inflight_requests FOR SELECT TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_inflight_expires ON public.ai_inflight_requests(expires_at);
