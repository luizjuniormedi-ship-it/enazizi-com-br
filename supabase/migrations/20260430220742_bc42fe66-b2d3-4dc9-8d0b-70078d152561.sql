-- Tabela de Alertas Operacionais
CREATE TABLE IF NOT EXISTS public.ai_operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL, -- 'gemini_error', 'rate_limit_429', 'json_failure', 'cache_failure', 'notebooklm_failure', 'fsrs_failure', 'hallucination_blocked'
    severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    content_id UUID REFERENCES public.master_content_library(id)
);

-- Habilitar RLS nos alertas
ALTER TABLE public.ai_operational_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view alerts" ON public.ai_operational_alerts FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Adicionar colunas de auditoria e revisão na biblioteca mestre
ALTER TABLE public.master_content_library 
ADD COLUMN IF NOT EXISTS audit_logs JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS export_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS hallucination_risk_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS cached_from_id UUID REFERENCES public.master_content_library(id);

-- Índices para otimização de cache
CREATE INDEX IF NOT EXISTS idx_mcl_discipline_topic ON public.master_content_library(discipline, topic);
CREATE INDEX IF NOT EXISTS idx_mcl_content_hash ON public.master_content_library(content_hash);

-- Função para registrar alerta automático
CREATE OR REPLACE FUNCTION public.log_ai_alert(
    p_type TEXT,
    p_severity TEXT,
    p_message TEXT,
    p_content_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.ai_operational_alerts (alert_type, severity, message, content_id, metadata)
    VALUES (p_type, p_severity, p_message, p_content_id, p_metadata)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
