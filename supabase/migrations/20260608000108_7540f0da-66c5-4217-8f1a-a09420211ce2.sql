CREATE OR REPLACE FUNCTION public.materialize_classifications(p_batch_id uuid DEFAULT NULL)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count integer;
    v_start_time timestamp with time zone := now();
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
    AND (p_batch_id IS NULL OR s.batch_id = p_batch_id)
    AND s.classification_status IN ('auto_approved_pending_sample', 'manual_approved');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Recalculate metrics after materialization
    PERFORM public.rebuild_curriculum_metrics();
    
    -- Log the execution in a snapshot
    INSERT INTO public.pmc_snapshots (
        phase,
        total_questions,
        topic_id_filled,
        competency_id_filled,
        specialty_id_filled,
        orphans,
        operational_competencies,
        cos_score,
        ocr_score,
        ccs_score,
        metadata
    )
    SELECT 
        'POST_MATERIALIZATION',
        (SELECT count(*) FROM public.questions_bank),
        (SELECT count(*) FROM public.questions_bank WHERE topic_id IS NOT NULL),
        (SELECT count(*) FROM public.questions_bank WHERE competency_id IS NOT NULL),
        (SELECT count(*) FROM public.questions_bank WHERE specialty_id IS NOT NULL),
        (SELECT count(*) FROM public.questions_bank WHERE topic_id IS NULL OR competency_id IS NULL),
        (SELECT count(*) FROM public.curriculum_topics WHERE visible_questions >= 10),
        (SELECT ROUND((count(CASE WHEN visible_questions >= 10 THEN 1 END)::numeric / NULLIF(count(*), 0)::numeric) * 100, 2) FROM public.curriculum_topics),
        (SELECT ROUND((count(CASE WHEN visible_questions > 0 THEN 1 END)::numeric / NULLIF(count(*), 0)::numeric) * 100, 2) FROM public.curriculum_topics),
        (SELECT ROUND(COALESCE(avg(classification_confidence), 0) * 100, 2) FROM public.questions_bank WHERE topic_id IS NOT NULL),
        jsonb_build_object(
            'batch_id', p_batch_id,
            'processed_count', v_count,
            'duration_ms', extract(epoch from (now() - v_start_time)) * 1000
        );
    
    RETURN v_count;
END;
$function$;
