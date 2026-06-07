-- 1. Adicionar classification_a faltante
ALTER TABLE public.question_classification_staging 
ADD COLUMN IF NOT EXISTS classification_a JSONB;

-- 2. View de Cobertura Real (Fase 5) - Colunas Corrigidas
CREATE OR REPLACE VIEW public.view_curriculum_coverage_audit AS
SELECT 
    cr.specialty,
    cr.curriculum_area,
    cr.curriculum_theme,
    cr.curriculum_competency,
    COUNT(DISTINCT qcs.question_id) as total_questions,
    COUNT(DISTINCT CASE WHEN qcs.is_exact_duplicate = false THEN qcs.question_id END) as unique_questions,
    COUNT(DISTINCT CASE WHEN qcs.is_exact_duplicate = true THEN qcs.question_id END) as duplicate_candidates
FROM public.curriculum_registry cr
LEFT JOIN public.question_classification_staging qcs ON qcs.competency_id = cr.id::text
GROUP BY cr.specialty, cr.curriculum_area, cr.curriculum_theme, cr.curriculum_competency;

-- 3. Função de Qualidade Refinada
CREATE OR REPLACE FUNCTION public.calculate_curriculum_quality_score()
RETURNS TRIGGER AS $$
DECLARE
    score NUMERIC := 0;
BEGIN
    -- 30% Competency Presence
    IF NEW.competency_id IS NOT NULL AND NEW.competency_id <> '' THEN score := score + 30; END IF;
    -- 25% Theme Presence
    IF NEW.predicted_theme IS NOT NULL THEN score := score + 25; END IF;
    -- 20% Subtheme Presence
    IF NEW.predicted_subtheme IS NOT NULL THEN score := score + 20; END IF;
    -- 25% Classifier Agreement
    IF NEW.classification_a IS NOT NULL AND NEW.classification_b IS NOT NULL THEN
        IF NEW.classification_a->>'competency_id' = NEW.classification_b->>'competency_id' THEN
            score := score + 25;
        END IF;
    END IF;

    NEW.quality_score := score;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
