-- View para Saúde Cognitiva (Cognitive Health)
CREATE OR REPLACE VIEW public.view_cognitive_health AS
SELECT 
    topic,
    count(*) as total_questions,
    avg(cognitive_quality_score) as avg_quality,
    avg(clinical_reasoning_depth) as avg_depth,
    avg(hallucination_risk_score) as avg_hallucination_risk
FROM public.questions_bank
WHERE quality_tier = 'GOLDEN'
GROUP BY topic;

-- View para Monitoramento de Drift (Pedagogical Drift)
CREATE OR REPLACE VIEW public.view_pedagogical_drift AS
SELECT 
    metric_type,
    created_at,
    divergence_score,
    (original_value->>'quality')::float as original_quality,
    (shadow_value->>'quality')::float as shadow_quality
FROM public.shadow_adaptive_metrics
WHERE metric_type = 'pedagogical_drift'
ORDER BY created_at DESC;

-- Função para detectar duplicatas semânticas (baseada em statement similar)
CREATE OR REPLACE FUNCTION public.detect_question_drift()
RETURNS TABLE (question_id UUID, similarity_score FLOAT) AS $$
BEGIN
    -- Simulação de detecção por similaridade (em produção usaria vetores)
    RETURN QUERY
    SELECT q1.id, 0.95 as similarity_score
    FROM public.questions_bank q1
    JOIN public.questions_bank q2 ON q1.id <> q2.id
    WHERE q1.statement = q2.statement
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
