-- 1. INCIDENT MANAGEMENT SYSTEM
CREATE TABLE IF NOT EXISTS public.incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'error_500', 'high_latency', 'edge_failure'
    severity TEXT NOT NULL, -- 'critical', 'warning', 'info'
    source TEXT NOT NULL, -- 'edge_function', 'frontend', 'database'
    metadata JSONB DEFAULT '{}'::jsonb,
    payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.incident_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.incident_events(id),
    status TEXT DEFAULT 'open', -- 'open', 'resolved', 'ignored'
    assigned_to UUID REFERENCES auth.users(id),
    alert_channel TEXT, -- 'slack', 'email', 'webhook'
    notified_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.incident_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES public.incident_alerts(id),
    user_id UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. AI SEMANTIC CACHE & ORCHESTRATOR
CREATE TABLE IF NOT EXISTS public.ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_hash TEXT UNIQUE NOT NULL,
    prompt_text TEXT,
    response_text TEXT,
    provider TEXT, -- 'openai', 'gemini', 'anthropic'
    model TEXT,
    tokens_used INTEGER,
    cost_saved NUMERIC(10, 5),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 3. ADVANCED PEDAGOGICAL ANALYTICS
CREATE TABLE IF NOT EXISTS public.pedagogical_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    topic_id TEXT,
    error_rate NUMERIC(5, 2),
    retention_score NUMERIC(5, 2),
    evolution_trend TEXT, -- 'improving', 'stagnant', 'declining'
    predicted_approval_rate NUMERIC(5, 2),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. SECURITY AUDIT & ANOMALY DETECTION
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource TEXT,
    ip_address INET,
    user_agent TEXT,
    is_anomaly BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_incident_events_type ON public.incident_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON public.ai_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON public.security_audit_logs(user_id);

-- ENABLE RLS
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- ADMIN POLICIES (Assuming admin role check)
CREATE POLICY "Admins can view all incident events" ON public.incident_events FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage alerts" ON public.incident_alerts FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- FUNCTION TO AUTO-DETECT INCIDENTS FROM TELEMETRY
CREATE OR REPLACE FUNCTION public.check_system_health()
RETURNS void AS $$
DECLARE
    error_count INT;
    avg_latency FLOAT;
BEGIN
    -- Check for high error rate (500s) in the last 5 minutes
    SELECT COUNT(*) INTO error_count FROM public.error_logs 
    WHERE created_at > now() - interval '5 minutes';
    
    IF error_count > 10 THEN
        INSERT INTO public.incident_events (event_type, severity, source, metadata)
        VALUES ('error_500_surge', 'critical', 'edge_function', jsonb_build_object('count', error_count));
    END IF;

    -- Check for high latency in telemetry
    SELECT AVG(duration_ms) INTO avg_latency FROM public.telemetry_logs
    WHERE created_at > now() - interval '5 minutes';

    IF avg_latency > 5000 THEN
        INSERT INTO public.incident_events (event_type, severity, source, metadata)
        VALUES ('high_latency_detected', 'warning', 'edge_function', jsonb_build_object('avg_latency', avg_latency));
    END IF;
END;
$$ LANGUAGE plpgsql;
