-- AI Efficiency Metrics Table for War Room Phase B
CREATE TABLE IF NOT EXISTS public.ai_efficiency_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day DATE NOT NULL DEFAULT CURRENT_DATE,
    feature_name TEXT NOT NULL,
    
    -- Economics
    total_requests INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    ai_calls INTEGER DEFAULT 0,
    tokens_input_total BIGINT DEFAULT 0,
    tokens_output_total BIGINT DEFAULT 0,
    estimated_cost_usd DECIMAL(12, 6) DEFAULT 0,
    estimated_savings_usd DECIMAL(12, 6) DEFAULT 0,
    
    -- Performance & Quality
    avg_latency_ms INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    fallback_count INTEGER DEFAULT 0,
    tutor_success_rate DECIMAL(5, 2), -- Qualitative score or binary success
    
    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(day, feature_name)
);

-- Grant permissions
GRANT SELECT ON public.ai_efficiency_metrics TO authenticated;
GRANT ALL ON public.ai_efficiency_metrics TO service_role;

-- RLS
ALTER TABLE public.ai_efficiency_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read efficiency metrics"
    ON public.ai_efficiency_metrics FOR SELECT
    TO authenticated
    USING (true);

-- Function to aggregate daily metrics from logs (Cron-ready)
CREATE OR REPLACE FUNCTION public.aggregate_ai_efficiency_daily(_target_day DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.ai_efficiency_metrics (
        day,
        feature_name,
        total_requests,
        cache_hits,
        ai_calls,
        tokens_input_total,
        tokens_output_total,
        estimated_cost_usd,
        estimated_savings_usd,
        avg_latency_ms,
        success_count,
        error_count,
        fallback_count,
        updated_at
    )
    SELECT 
        _target_day,
        module,
        COUNT(*),
        COUNT(*) FILTER (WHERE cache_status = 'hit'),
        COUNT(*) FILTER (WHERE cache_status != 'hit' AND success = true),
        SUM(input_tokens) FILTER (WHERE input_tokens IS NOT NULL),
        SUM(output_tokens) FILTER (WHERE output_tokens IS NOT NULL),
        SUM(cost_estimate) FILTER (WHERE cost_estimate IS NOT NULL),
        SUM(cost_saved) FILTER (WHERE cost_saved IS NOT NULL),
        AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL)::INTEGER,
        COUNT(*) FILTER (WHERE success = true),
        COUNT(*) FILTER (WHERE success = false),
        COUNT(*) FILTER (WHERE cache_status = 'fallback'), -- Assuming we tag fallbacks in cache_status
        now()
    FROM public.ai_usage_logs
    WHERE created_at::DATE = _target_day
    GROUP BY module
    ON CONFLICT (day, feature_name) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        cache_hits = EXCLUDED.cache_hits,
        ai_calls = EXCLUDED.ai_calls,
        tokens_input_total = EXCLUDED.tokens_input_total,
        tokens_output_total = EXCLUDED.tokens_output_total,
        estimated_cost_usd = EXCLUDED.estimated_cost_usd,
        estimated_savings_usd = EXCLUDED.estimated_savings_usd,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        success_count = EXCLUDED.success_count,
        error_count = EXCLUDED.error_count,
        fallback_count = EXCLUDED.fallback_count,
        updated_at = now();
END;
$$;
