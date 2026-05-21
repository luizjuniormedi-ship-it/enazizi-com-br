-- 1. Tabela de Eventos de Runtime Cognitivo
CREATE TABLE public.cognitive_runtime_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_id UUID,
    correlation_id UUID,
    event_type TEXT NOT NULL, -- 'LOOP_DETECTED', 'STUDENT_FATIGUE', 'TRUNCATION_RISK', 'RECOVERY_TRIGGERED', 'ABANDONMENT_RISK'
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
    topic TEXT,
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cognitive_runtime_events ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view their own cognitive events"
ON public.cognitive_runtime_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert cognitive events"
ON public.cognitive_runtime_events FOR INSERT
WITH CHECK (true); -- Permitido via Service Role/Edge Function

-- Índices para performance
CREATE INDEX idx_cognitive_events_user_created ON public.cognitive_runtime_events(user_id, created_at DESC);
CREATE INDEX idx_cognitive_events_session ON public.cognitive_runtime_events(session_id);
CREATE INDEX idx_cognitive_events_type ON public.cognitive_runtime_events(event_type);

-- 2. Evolução de pedagogical_sessions para Governança
ALTER TABLE public.pedagogical_sessions
ADD COLUMN IF NOT EXISTS cognitive_quality_score NUMERIC DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS fatigue_index NUMERIC DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS loop_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_recovery_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS continuity_stable BOOLEAN DEFAULT true;

-- 3. Função para limpeza de sessões mortas (Dead Session Cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_dead_pedagogical_sessions()
RETURNS void AS $$
BEGIN
    -- Marca sessões sem atualização há mais de 24h como abandonadas
    UPDATE public.pedagogical_sessions
    SET cognitive_state = 'ABANDONED',
        updated_at = now()
    WHERE updated_at < now() - interval '24 hours'
      AND cognitive_state NOT IN ('COMPLETED', 'ABANDONED');
END;
$$ LANGUAGE plpgsql;

-- 4. View de Sumário de Governança para Dashboard
CREATE OR REPLACE VIEW public.v_tutor_governance_summary AS
SELECT 
    COUNT(*) as total_sessions,
    AVG(cognitive_quality_score) as avg_quality_score,
    SUM(CASE WHEN fatigue_index > 0.7 THEN 1 ELSE 0 END) as fatigue_alerts,
    SUM(loop_count) as total_loops_detected,
    (SELECT COUNT(*) FROM public.cognitive_runtime_events WHERE event_type = 'RECOVERY_TRIGGERED') as recoveries_triggered,
    (SELECT COUNT(*) FROM public.tutor_runtime_metrics WHERE duplicate_key_recovered = true) as duplicate_keys_prevented
FROM public.pedagogical_sessions
WHERE updated_at > now() - interval '7 days';

GRANT SELECT ON public.v_tutor_governance_summary TO authenticated, service_role;
