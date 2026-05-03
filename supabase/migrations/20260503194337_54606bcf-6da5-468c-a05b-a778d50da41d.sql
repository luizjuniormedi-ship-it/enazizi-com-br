-- Tabela de thresholds de governança
CREATE TABLE IF NOT EXISTS public.governance_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    description TEXT,
    value JSONB NOT NULL,
    category TEXT NOT NULL, -- 'ai', 'performance', 'engagement', 'errors'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.governance_thresholds ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage governance thresholds"
ON public.governance_thresholds
FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
));

-- Default thresholds
INSERT INTO public.governance_thresholds (key, category, description, value)
VALUES 
('ai_latency_threshold_ms', 'ai', 'Threshold para resposta lenta do Tutor IA', '{"ms": 10000}'),
('session_abandonment_rate', 'engagement', 'Taxa de abandono de sessão crítica (%)', '{"percent": 40}'),
('fallback_rate_critical', 'ai', 'Taxa de fallback da IA crítica (%)', '{"percent": 15}'),
('error_rate_critical', 'errors', 'Taxa de erro Supabase/Edge Functions (%)', '{"percent": 5}'),
('loading_stall_threshold_ms', 'performance', 'Tempo de carregamento infinito (ms)', '{"ms": 15000}')
ON CONFLICT (key) DO NOTHING;

-- RPC para Auditoria de Dados
CREATE OR REPLACE FUNCTION admin_telemetry_audit()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'orphan_events', (SELECT count(*) FROM telemetry_events WHERE user_id IS NULL),
        'open_sessions', (SELECT count(*) FROM telemetry_events te1 
                          WHERE event_name = 'session_started' 
                          AND NOT EXISTS (
                              SELECT 1 FROM telemetry_events te2 
                              WHERE te2.session_id = te1.session_id 
                              AND te2.event_name IN ('session_completed', 'session_abandoned')
                          )),
        'missing_routes', (SELECT count(*) FROM telemetry_events WHERE route IS NULL OR route = ''),
        'timestamp_gaps', (SELECT count(*) FROM (
                                SELECT timestamp, lead(timestamp) OVER (ORDER BY timestamp) as next_ts
                                FROM telemetry_events
                            ) t WHERE next_ts - timestamp > interval '1 hour'),
        'duplicate_events', (SELECT count(*) FROM (
                                SELECT user_id, session_id, event_name, timestamp, count(*)
                                FROM telemetry_events
                                GROUP BY 1,2,3,4
                                HAVING count(*) > 1
                            ) d)
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC para RCA (Root Cause Analysis)
CREATE OR REPLACE FUNCTION admin_telemetry_rca(alert_id TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Simulação de diagnóstico baseado em padrões (no futuro pode ser via IA)
    SELECT jsonb_build_object(
        'probable_cause', 'Latência elevada na Edge Function detectada.',
        'affected_routes', (SELECT jsonb_agg(DISTINCT route) FROM telemetry_events WHERE timestamp > now() - interval '1 hour' AND metadata->>'error' IS NOT NULL),
        'evidence_count', (SELECT count(*) FROM telemetry_events WHERE timestamp > now() - interval '1 hour' AND metadata->>'error' IS NOT NULL),
        'next_steps', 'Verificar logs da função "tutor-stream" e carga no banco.'
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
