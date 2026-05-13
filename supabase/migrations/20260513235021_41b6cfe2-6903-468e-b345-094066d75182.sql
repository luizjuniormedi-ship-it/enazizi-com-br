-- Tabela para métricas de Shadow Mode (validação silenciosa)
CREATE TABLE IF NOT EXISTS public.shadow_adaptive_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID, -- Referência flexível a sessions ou adaptive_session_logs
    decision_id UUID REFERENCES public.orchestrator_decisions(id),
    user_id UUID REFERENCES auth.users(id),
    metric_type TEXT NOT NULL, -- 'fsrs_drift', 'pedagogical_divergence', 'recommendation_mismatch'
    original_value JSONB,
    shadow_value JSONB,
    divergence_score FLOAT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para Auditoria de Stress do Pipeline de Questões
CREATE TABLE IF NOT EXISTS public.pipeline_stress_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    operation_type TEXT NOT NULL, -- 'mass_generation', 'validation_bulk', 'deduplication'
    status TEXT NOT NULL, -- 'success', 'failure', 'retry'
    duration_ms INTEGER,
    payload_size_kb INTEGER,
    error_details TEXT,
    quality_score_avg FLOAT,
    anti_hallucination_score_avg FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adição de colunas de monitoramento de escala na tabela questions_bank
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS cognitive_quality_score FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS hallucination_risk_score FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS clinical_reasoning_depth INTEGER DEFAULT 1;

-- Índices para performance em escala massiva
CREATE INDEX IF NOT EXISTS idx_questions_bank_quality_score ON public.questions_bank(cognitive_quality_score);
CREATE INDEX IF NOT EXISTS idx_shadow_metrics_type ON public.shadow_adaptive_metrics(metric_type);

-- Enable RLS for new tables
ALTER TABLE public.shadow_adaptive_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stress_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Shadow Metrics
CREATE POLICY "Admin full access shadow_metrics" ON public.shadow_adaptive_metrics 
    FOR ALL USING (true);

CREATE POLICY "Admin full access pipeline_stress" ON public.pipeline_stress_logs 
    FOR ALL USING (true);

-- Trigger para detecção de Drift Pedagógico na questions_bank
CREATE OR REPLACE FUNCTION public.check_pedagogical_drift_v9()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cognitive_quality_score < 0.7 OR NEW.hallucination_risk_score > 0.3 THEN
        INSERT INTO public.shadow_adaptive_metrics (metric_type, original_value, divergence_score)
        VALUES ('pedagogical_drift', jsonb_build_object('question_id', NEW.id, 'quality', NEW.cognitive_quality_score, 'hallucination', NEW.hallucination_risk_score), 1.0);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_detect_drift_v9
AFTER INSERT OR UPDATE ON public.questions_bank
FOR EACH ROW EXECUTE FUNCTION public.check_pedagogical_drift_v9();