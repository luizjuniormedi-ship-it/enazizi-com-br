-- 1. Automatic Scoring Engine Trigger
CREATE OR REPLACE FUNCTION public.calculate_medical_scores()
RETURNS TRIGGER AS $$
BEGIN
    -- Weights: Scientific (40%), Safety (30%), Pedagogical (20%), Technical/Quiz (10%)
    -- Reliability is inverse of Hallucination Risk + Accuracy
    NEW.final_score := (
        (COALESCE(NEW.scientific_accuracy_score, 0) * 0.4) +
        (COALESCE(NEW.clinical_safety_score, 0) * 0.3) +
        (COALESCE(NEW.pedagogical_clarity_score, 0) * 0.2) +
        ((COALESCE(NEW.flashcard_quality_score, 0) + COALESCE(NEW.quiz_quality_score, 0)) / 2 * 0.1)
    );

    -- Reliability score (0-100)
    -- High hallucination risk severely penalizes reliability
    NEW.reliability_score := GREATEST(0, LEAST(100, 
        (COALESCE(NEW.scientific_accuracy_score, 0) * 10) - (COALESCE(NEW.hallucination_risk_score, 0) * 15)
    ));

    -- Mark as approved if it meets thresholds
    IF NEW.scientific_accuracy_score >= 8 AND NEW.clinical_safety_score >= 8 AND NEW.hallucination_risk_score <= 4 THEN
        NEW.approved := TRUE;
    ELSE
        NEW.approved := FALSE;
    END IF;

    -- Sync back to master library
    UPDATE public.master_content_library
    SET 
        reliability_score = NEW.reliability_score,
        double_reviewed = (
            SELECT COUNT(DISTINCT reviewer_id) >= 2 
            FROM public.medical_content_scores 
            WHERE content_id = NEW.content_id
        )
    WHERE id = NEW.content_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_calculate_medical_scores
BEFORE INSERT OR UPDATE ON public.medical_content_scores
FOR EACH ROW EXECUTE FUNCTION public.calculate_medical_scores();

-- 2. Enhanced Publication & Export Guard
CREATE OR REPLACE FUNCTION public.check_governance_locks()
RETURNS TRIGGER AS $$
DECLARE
    latest_score RECORD;
    review_count INTEGER;
BEGIN
    -- LOCK 1: Publication Requirements
    IF NEW.status = 'published' THEN
        SELECT * INTO latest_score 
        FROM public.medical_content_scores 
        WHERE content_id = NEW.id 
        ORDER BY created_at DESC LIMIT 1;

        SELECT COUNT(DISTINCT id) INTO review_count 
        FROM public.medical_content_scores 
        WHERE content_id = NEW.id;

        IF latest_score.id IS NULL THEN
            RAISE EXCEPTION 'Nenhuma pontuação de governança encontrada. Revisão obrigatória.';
        END IF;

        IF latest_score.scientific_accuracy_score < 8 THEN
            RAISE EXCEPTION 'Acurácia científica insuficiente (%) para publicação.', latest_score.scientific_accuracy_score;
        END IF;

        IF latest_score.clinical_safety_score < 8 THEN
            RAISE EXCEPTION 'Segurança clínica insuficiente (%) para publicação.', latest_score.clinical_safety_score;
        END IF;

        IF latest_score.hallucination_risk_score > 4 THEN
            RAISE EXCEPTION 'Risco de alucinação muito alto (%). Bloqueado.', latest_score.hallucination_risk_score;
        END IF;

        IF NOT NEW.double_reviewed THEN
            RAISE EXCEPTION 'Revisão dupla obrigatória não concluída.';
        END IF;
    END IF;

    -- LOCK 2: NotebookLM Export Requirements
    -- If user is trying to set media_status to 'exported' or updating export fields
    IF (NEW.media_status = 'exported' AND OLD.media_status IS DISTINCT FROM 'exported') OR 
       (NEW.notebooklm_export_version IS DISTINCT FROM OLD.notebooklm_export_version) THEN
        
        IF NEW.status != 'approved' AND NEW.status != 'published' THEN
            RAISE EXCEPTION 'Exportação NotebookLM permitida apenas para conteúdos com status "approved" ou "published".';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the existing trigger or create if not exists
DROP TRIGGER IF EXISTS enforce_medical_governance_before_publish ON public.master_content_library;
CREATE TRIGGER enforce_medical_governance_v1_4
BEFORE UPDATE ON public.master_content_library
FOR EACH ROW
EXECUTE FUNCTION public.check_governance_locks();
