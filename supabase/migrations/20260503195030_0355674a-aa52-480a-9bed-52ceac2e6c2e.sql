
-- 1. TRIAGE DE INCIDENTES (Classification & Thresholds enhancement)
ALTER TABLE public.admin_incidents 
ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('P0', 'P1', 'P2', 'P3')) DEFAULT 'P3',
ADD COLUMN IF NOT EXISTS affected_users_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS impact_score NUMERIC DEFAULT 0;

-- 2. PESQUISA E CORRELAÇÃO
CREATE TABLE IF NOT EXISTS public.incident_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.admin_incidents(id) ON DELETE CASCADE,
    correlated_incident_id UUID REFERENCES public.admin_incidents(id) ON DELETE CASCADE,
    correlation_type TEXT NOT NULL, -- 'route', 'edge_function', 'error_pattern', 'deploy'
    confidence_score NUMERIC DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. AGENDADOR DE DIGESTS
CREATE TABLE IF NOT EXISTS public.operational_digests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    digest_type TEXT NOT NULL, -- 'daily', 'weekly', 'executive', 'pedagogical', 'operational'
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    content JSONB, -- aggregated metrics
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. POLÍTICAS DE RETENÇÃO
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT UNIQUE NOT NULL,
    retention_days INTEGER NOT NULL,
    action TEXT DEFAULT 'delete', -- 'delete', 'archive'
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Function for scheduled cleanup (Retention Engine)
CREATE OR REPLACE FUNCTION public.execute_data_retention()
RETURNS void AS $$
DECLARE
    policy RECORD;
BEGIN
    FOR policy IN SELECT * FROM public.data_retention_policies LOOP
        EXECUTE format('DELETE FROM %I WHERE created_at < now() - interval ''%s days''', 
            policy.table_name, policy.retention_days);
        
        UPDATE public.data_retention_policies 
        SET last_run_at = now() 
        WHERE id = policy.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. AUTO-MITIGAÇÃO
CREATE TABLE IF NOT EXISTS public.auto_mitigation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.admin_incidents(id) ON DELETE SET NULL,
    action_taken TEXT NOT NULL, -- 'restart_edge_function', 'fallback_ai_model', 'reduce_realtime', 'degraded_mode'
    target TEXT, -- e.g. function name, route
    status TEXT DEFAULT 'initiated', -- 'initiated', 'success', 'failed'
    result_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. PLAYBOOKS OPERACIONAIS
CREATE TABLE IF NOT EXISTS public.operational_playbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type TEXT NOT NULL, -- 'tutor_slow', 'supabase_timeout', 'high_abandonment'
    title TEXT NOT NULL,
    steps JSONB NOT NULL, -- list of steps to resolve
    mitigation_strategy TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. DASHBOARD NOC (Unified metrics view)
CREATE OR REPLACE VIEW public.noc_metrics AS
SELECT 
    (SELECT count(*) FROM public.admin_incidents WHERE status = 'open' AND priority = 'P0') as critical_incidents,
    (SELECT avg((properties->>'latency_ms')::numeric) FROM public.telemetry_events WHERE timestamp > now() - interval '5 minutes' AND properties->>'latency_ms' IS NOT NULL) as avg_latency,
    (SELECT count(DISTINCT user_id) FROM public.telemetry_events WHERE timestamp > now() - interval '5 minutes') as active_users,
    (SELECT count(*) FROM public.telemetry_events WHERE event_name = 'session_abandoned' AND timestamp > now() - interval '1 hour') as hourly_abandonment;

-- Default policies
INSERT INTO public.data_retention_policies (table_name, retention_days) VALUES
('telemetry_events', 90),
('governance_logs', 365),
('admin_incidents', 180),
('auto_mitigation_logs', 90)
ON CONFLICT (table_name) DO UPDATE SET retention_days = EXCLUDED.retention_days;

-- Enable RLS
ALTER TABLE public.incident_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_mitigation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_playbooks ENABLE ROW LEVEL SECURITY;

-- Admin policies
DROP POLICY IF EXISTS "Admins can manage correlations" ON public.incident_correlations;
CREATE POLICY "Admins can manage correlations" ON public.incident_correlations FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admins can manage digests" ON public.operational_digests;
CREATE POLICY "Admins can manage digests" ON public.operational_digests FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admins can manage retention" ON public.data_retention_policies;
CREATE POLICY "Admins can manage retention" ON public.data_retention_policies FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admins can manage mitigation" ON public.auto_mitigation_logs;
CREATE POLICY "Admins can manage mitigation" ON public.auto_mitigation_logs FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Admins can manage playbooks" ON public.operational_playbooks;
CREATE POLICY "Admins can manage playbooks" ON public.operational_playbooks FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
