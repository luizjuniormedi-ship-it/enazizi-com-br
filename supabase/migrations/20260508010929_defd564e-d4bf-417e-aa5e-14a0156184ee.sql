-- Adicionar peso efetivo para evitar overfitting
ALTER TABLE public.exam_blueprints 
ADD COLUMN IF NOT EXISTS effective_weight DECIMAL(5,2) GENERATED ALWAYS AS (weight * confidence_score) STORED;

-- Políticas de Auto-Reconciliação
CREATE TABLE public.exam_auto_reconcile_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_key TEXT NOT NULL UNIQUE,
    auto_apply_low BOOLEAN DEFAULT true,
    require_approval_medium BOOLEAN DEFAULT true,
    require_approval_high BOOLEAN DEFAULT true,
    block_critical BOOLEAN DEFAULT true,
    min_confidence_threshold DECIMAL(3,2) DEFAULT 0.6,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Histórico de Saúde do Blueprint (Observabilidade)
CREATE TABLE public.exam_health_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_key TEXT NOT NULL,
    health_score DECIMAL(5,2), -- 0 a 100
    confidence_avg DECIMAL(3,2),
    sample_adequacy_score DECIMAL(3,2),
    freshness_score DECIMAL(3,2),
    stability_score DECIMAL(3,2),
    status TEXT, -- healthy, warning, critical
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.exam_auto_reconcile_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_health_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access policies" ON public.exam_auto_reconcile_policies FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access health" ON public.exam_health_history FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Função para calcular Health Score (0-100)
CREATE OR REPLACE FUNCTION public.calculate_blueprint_health(p_exam_key TEXT)
RETURNS DECIMAL AS $$
DECLARE
    v_conf DECIMAL;
    v_sample_adequacy DECIMAL;
    v_freshness DECIMAL;
    v_stability DECIMAL;
    v_health DECIMAL;
BEGIN
    -- Confidence (0-1)
    SELECT AVG(confidence_score) INTO v_conf FROM public.exam_blueprints WHERE exam_key = p_exam_key AND is_active = true;
    
    -- Sample Adequacy (Normalizado para 1000 questões)
    SELECT LEAST(1.0, SUM(sample_size)::decimal / 2000.0) INTO v_sample_adequacy FROM public.exam_blueprints WHERE exam_key = p_exam_key AND is_active = true;
    
    -- Freshness (Dias desde a última recalibração)
    SELECT LEAST(1.0, 30.0 / GREATEST(1.0, EXTRACT(DAY FROM now() - MAX(last_recalculated_at)))) INTO v_freshness 
    FROM public.exam_blueprints WHERE exam_key = p_exam_key AND is_active = true;

    -- Stability (Inverso da quantidade de drifts críticos recentes)
    SELECT LEAST(1.0, 5.0 / GREATEST(1.0, COUNT(*))) INTO v_stability 
    FROM public.exam_drift_logs WHERE exam_key = p_exam_key AND severity IN ('high', 'critical') AND detected_at > now() - interval '30 days';

    v_health := (COALESCE(v_conf, 0) * 0.3 + v_sample_adequacy * 0.3 + v_freshness * 0.2 + v_stability * 0.2) * 100;
    
    RETURN LEAST(100, v_health);
END;
$$ LANGUAGE plpgsql STABLE;
