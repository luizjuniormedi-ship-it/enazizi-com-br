-- 1. Tabela para os clusters de ambiguidade definidos pelo auditor
CREATE TABLE public.ambiguity_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_name TEXT NOT NULL,
    term_a TEXT NOT NULL,
    term_b TEXT NOT NULL,
    expected_primary_resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiguity_clusters TO authenticated;
GRANT ALL ON public.ambiguity_clusters TO service_role;
ALTER TABLE public.ambiguity_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access for authenticated users" ON public.ambiguity_clusters FOR ALL USING (true);

-- Inserir os 10 clusters obrigatórios
INSERT INTO public.ambiguity_clusters (cluster_name, term_a, term_b) VALUES
('Cluster 1', 'IAM', 'Dor Torácica'),
('Cluster 2', 'Sepse', 'Choque'),
('Cluster 3', 'Apendicite', 'Abdome Agudo'),
('Cluster 4', 'AVC', 'Neurologia Geral'),
('Cluster 5', 'TEP', 'Dispneia'),
('Cluster 6', 'Insuficiência Cardíaca', 'Edema Agudo'),
('Cluster 7', 'Pré-eclâmpsia', 'Hipertensão Gestacional'),
('Cluster 8', 'Hipercalemia', 'IRA'),
('Cluster 9', 'Pneumonia', 'Insuficiência Respiratória'),
('Cluster 10', 'Trauma', 'Emergência Geral');

-- 2. Tabela para logs de amostragem adversarial
CREATE TABLE public.adversarial_sampling_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions_bank(id),
    wave_id UUID NOT NULL REFERENCES public.promotion_waves(id),
    selection_reason TEXT NOT NULL, -- ex: 'low_confidence', 'ambiguity_cluster_1', 'multi_competency'
    semantic_risk_score NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adversarial_sampling_log TO authenticated;
GRANT ALL ON public.adversarial_sampling_log TO service_role;
ALTER TABLE public.adversarial_sampling_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Full access for authenticated users" ON public.adversarial_sampling_log FOR ALL USING (true);

-- 3. Extensão de audit_reports para métricas de Wave 2
ALTER TABLE public.audit_reports 
ADD COLUMN IF NOT EXISTS dual_classifier_divergence NUMERIC,
ADD COLUMN IF NOT EXISTS rare_competency_accuracy NUMERIC,
ADD COLUMN IF NOT EXISTS effective_coverage_ratio NUMERIC,
ADD COLUMN IF NOT EXISTS production_readiness_score NUMERIC;

-- 4. View para Relatório de Certificação Wave 2
CREATE OR REPLACE VIEW public.v_wave_2_stress_report AS
SELECT 
    w.id as wave_id,
    w.wave_number,
    ar.accuracy_competency as primary_competency_accuracy,
    ar.dual_classifier_divergence,
    ar.false_positive_rate,
    ar.false_negative_rate,
    ar.rare_competency_accuracy,
    ar.confidence_calibration_error,
    ar.drift_score,
    ar.production_readiness_score,
    CASE 
        WHEN ar.production_readiness_score >= 0.97 
             AND ar.accuracy_competency >= 0.95 
             AND ar.false_positive_rate <= 0.01 
             AND ar.dual_classifier_divergence <= 0.05
        THEN 'CERTIFIED'
        ELSE 'REJECTED'
    END as certification_status
FROM public.promotion_waves w
LEFT JOIN public.audit_reports ar ON w.id = ar.wave_id
WHERE w.wave_number = 2;

GRANT SELECT ON public.v_wave_2_stress_report TO authenticated;
GRANT SELECT ON public.v_wave_2_stress_report TO service_role;
