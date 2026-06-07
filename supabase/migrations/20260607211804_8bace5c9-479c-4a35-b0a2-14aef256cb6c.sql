
-- 1. Controle de Ondas de Promoção
CREATE TABLE public.promotion_waves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wave_number INTEGER NOT NULL, -- 1, 2, 3, 4
    target_size INTEGER NOT NULL, -- 500, 2000, 5000, 11500
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'auditing', 'approved', 'rejected', 'completed')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Relatórios de Auditoria (Estatísticas por Onda/Especialidade)
CREATE TABLE public.audit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wave_id UUID REFERENCES public.promotion_waves(id),
    specialty TEXT NOT NULL,
    total_samples INTEGER NOT NULL,
    accuracy_theme DECIMAL(5,2),
    accuracy_subtheme DECIMAL(5,2),
    accuracy_competency DECIMAL(5,2),
    accuracy_competency_id DECIMAL(5,2),
    false_positive_rate DECIMAL(5,2),
    false_negative_rate DECIMAL(5,2),
    confidence_calibration_error DECIMAL(5,2),
    drift_score DECIMAL(5,2),
    is_rare_competency_audit BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Validação de Competências Críticas (Zero Erro)
CREATE TABLE public.critical_competency_validation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL,
    competency_id UUID NOT NULL,
    classifier_a_result JSONB,
    classifier_b_result JSONB,
    is_consensus BOOLEAN GENERATED ALWAYS AS (classifier_a_result->>'competency_id' = classifier_b_result->>'competency_id') STORED,
    final_status TEXT DEFAULT 'pending' CHECK (final_status IN ('pending', 'validated', 'rejected')),
    validated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. View de Score de Prontidão (Production Readiness Score)
CREATE OR REPLACE VIEW public.v_production_readiness_score AS
WITH metrics AS (
    SELECT 
        AVG(accuracy_competency) as avg_acc_comp,
        AVG(accuracy_theme) as avg_acc_theme,
        AVG(confidence_calibration_error) as avg_calib_error,
        AVG(false_positive_rate) as avg_fpr,
        AVG(false_negative_rate) as avg_fnr,
        AVG(drift_score) as avg_drift
    FROM public.audit_reports
    WHERE created_at > now() - interval '24 hours'
)
SELECT 
    (
        (COALESCE(avg_acc_comp, 0) * 0.25) + 
        (COALESCE(avg_acc_theme, 0) * 0.20) + 
        (100 - COALESCE(avg_calib_error, 0) * 0.15) + 
        (100 - COALESCE(avg_fpr, 0) * 0.15) + 
        (100 - COALESCE(avg_fnr, 0) * 0.10) + 
        (100 - COALESCE(avg_drift, 0) * 0.05)
    ) as final_readiness_score,
    *
FROM metrics;

-- 5. Função para detecção de duplicidade e cobertura real
CREATE OR REPLACE FUNCTION public.calculate_real_coverage(p_competency_id UUID)
RETURNS TABLE (
    total_questions BIGINT,
    unique_questions BIGINT,
    duplicate_count BIGINT,
    effective_coverage_ratio DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH counts AS (
        SELECT 
            count(*) as total,
            count(DISTINCT COALESCE(q.metadata->>'semantic_hash', q.id::text)) as unique_q
        FROM public.question_classification_staging q
        WHERE q.competency_id = p_competency_id
        AND q.lifecycle_state = 'ready_for_promotion'
    )
    SELECT 
        total,
        unique_q,
        total - unique_q,
        (unique_q::decimal / NULLIF(total, 0))
    FROM counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.promotion_waves TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.audit_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.critical_competency_validation TO authenticated;
GRANT SELECT ON public.v_production_readiness_score TO authenticated;
GRANT ALL ON public.promotion_waves TO service_role;
GRANT ALL ON public.audit_reports TO service_role;
GRANT ALL ON public.critical_competency_validation TO service_role;

-- Inserir ondas iniciais
INSERT INTO public.promotion_waves (wave_number, target_size, metadata) VALUES 
(1, 500, '{"description": "Sentinel Wave - Strategic Audit"}'::jsonb),
(2, 2000, '{"description": "Expansion Wave - Volume Test"}'::jsonb),
(3, 5000, '{"description": "Scaling Wave - Stability Check"}'::jsonb),
(4, 11500, '{"description": "Final Wave - Full Migration"}'::jsonb);
