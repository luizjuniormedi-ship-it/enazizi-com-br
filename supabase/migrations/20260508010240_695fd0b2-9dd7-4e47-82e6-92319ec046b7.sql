-- Tabela de Auditoria de Reconciliação
CREATE TABLE IF NOT EXISTS public.exam_reconciliation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_key TEXT NOT NULL,
    old_version TEXT,
    new_version TEXT NOT NULL,
    smoothing_factor DECIMAL(3,2) NOT NULL,
    sample_size INTEGER NOT NULL,
    confidence_before DECIMAL(3,2),
    confidence_after DECIMAL(3,2),
    triggered_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Evoluir tabela de Drift
ALTER TABLE public.exam_drift_logs 
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'low',
ADD COLUMN IF NOT EXISTS source_version TEXT;

-- Atualizar trigger de Drift para incluir severity
CREATE OR REPLACE FUNCTION public.log_exam_blueprint_drift()
RETURNS TRIGGER AS $$
DECLARE
    v_severity TEXT;
BEGIN
    v_severity := CASE 
        WHEN ABS(NEW.weight - OLD.weight) >= 10.0 THEN 'critical'
        WHEN ABS(NEW.weight - OLD.weight) >= 5.0 THEN 'high'
        WHEN ABS(NEW.weight - OLD.weight) >= 2.0 THEN 'medium'
        ELSE 'low'
    END;

    IF (ABS(NEW.weight - OLD.weight) >= 1.0) THEN
        INSERT INTO public.exam_drift_logs (exam_key, topic, old_weight, new_weight, delta, reason, severity, source_version)
        VALUES (
            NEW.exam_key, 
            NEW.topic, 
            OLD.weight, 
            NEW.weight, 
            NEW.weight - OLD.weight, 
            'Recalibração automática via Intelligence Engine',
            v_severity,
            NEW.version
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Refinado
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_blueprint_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_drift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_reconciliation_logs ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas
DROP POLICY IF EXISTS "Leitura pública de blueprints" ON public.exam_blueprints;
DROP POLICY IF EXISTS "Leitura de versões por usuários autenticados" ON public.exam_blueprint_versions;
DROP POLICY IF EXISTS "Leitura de logs de drift por usuários autenticados" ON public.exam_drift_logs;
DROP POLICY IF EXISTS "Admin full access blueprints" ON public.exam_blueprints;
DROP POLICY IF EXISTS "Admin full access versions" ON public.exam_blueprint_versions;
DROP POLICY IF EXISTS "Admin full access drift" ON public.exam_drift_logs;
DROP POLICY IF EXISTS "Admin full access reconciliation" ON public.exam_reconciliation_logs;
DROP POLICY IF EXISTS "Teacher read blueprints" ON public.exam_blueprints;
DROP POLICY IF EXISTS "Teacher read versions" ON public.exam_blueprint_versions;
DROP POLICY IF EXISTS "Teacher read drift" ON public.exam_drift_logs;

-- Políticas de ADMIN
CREATE POLICY "Admin full access blueprints" ON public.exam_blueprints FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access versions" ON public.exam_blueprint_versions FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access drift" ON public.exam_drift_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access reconciliation" ON public.exam_reconciliation_logs FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Políticas de PROFESSOR
CREATE POLICY "Teacher read blueprints" ON public.exam_blueprints FOR SELECT USING (public.has_role(auth.uid(), 'professor'));
CREATE POLICY "Teacher read versions" ON public.exam_blueprint_versions FOR SELECT USING (public.has_role(auth.uid(), 'professor'));
CREATE POLICY "Teacher read drift" ON public.exam_drift_logs FOR SELECT USING (public.has_role(auth.uid(), 'professor'));
CREATE POLICY "Teacher read reconciliation" ON public.exam_reconciliation_logs FOR SELECT USING (public.has_role(auth.uid(), 'professor'));
