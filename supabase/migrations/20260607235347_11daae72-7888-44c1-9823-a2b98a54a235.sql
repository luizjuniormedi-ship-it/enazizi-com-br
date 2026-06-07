-- 2. METRIC RECALCULATION FUNCTION
CREATE OR REPLACE FUNCTION public.rebuild_curriculum_metrics()
RETURNS void AS $$
BEGIN
    -- Update visible_questions for all topics based on approved questions
    UPDATE public.curriculum_topics t
    SET visible_questions = (
        SELECT count(*) 
        FROM public.questions_bank q 
        WHERE q.topic_id = t.id 
        AND q.review_status = 'approved'
    );
    
    -- RPS (Relative Pedagogical Strength) recalculation
    UPDATE public.curriculum_topics 
    SET rps = CASE 
        WHEN visible_questions = 0 THEN 0 
        ELSE (visible_questions::numeric / 50.0) * 100 
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. MATERIALIZATION FUNCTION (DRY-RUN TERMINATION)
CREATE OR REPLACE FUNCTION public.materialize_classifications(p_batch_id UUID)
RETURNS integer AS $$
DECLARE
    v_count integer;
BEGIN
    -- Update questions_bank with predictions from staging
    UPDATE public.questions_bank q
    SET 
        topic_id = s.topic_id,
        competency_id = s.competency_id,
        specialty_id = s.specialty_id,
        curriculum_area = s.predicted_area,
        curriculum_theme = s.predicted_theme,
        curriculum_subtheme = s.predicted_subtheme,
        classified_at = now(),
        classification_method = 'ai_reconstructor',
        classification_confidence = s.confidence_score
    FROM public.question_classification_staging s
    WHERE q.id = s.question_id
    AND s.batch_id = p_batch_id
    AND s.classification_status IN ('auto_approved_pending_sample', 'manual_approved');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Recalculate metrics after materialization
    PERFORM public.rebuild_curriculum_metrics();
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.rebuild_curriculum_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_curriculum_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.materialize_classifications(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.materialize_classifications(UUID) TO service_role;
