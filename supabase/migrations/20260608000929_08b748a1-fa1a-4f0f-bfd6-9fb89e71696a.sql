CREATE OR REPLACE FUNCTION public.materialize_classifications(p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_count integer;
    v_start_time timestamp with time zone := now();
BEGIN
    -- Update questions_bank with predictions from staging
    -- We join with curriculum_registry to get the correct UUID for competency_id
    UPDATE public.questions_bank q
    SET 
        competency_id = r.id,
        curriculum_area = s.predicted_area,
        curriculum_theme = s.predicted_theme,
        curriculum_subtheme = s.predicted_subtheme,
        curriculum_competency = s.predicted_competency,
        classified_at = now(),
        classification_method = 'ai_reconstructor',
        classification_confidence = s.confidence_score
    FROM public.question_classification_staging s
    JOIN public.curriculum_registry r ON s.competency_id = r.competency_id
    WHERE q.id = s.question_id
    AND (p_batch_id IS NULL OR s.batch_id = p_batch_id)
    AND s.classification_status IN ('auto_approved_pending_sample', 'manual_approved', 'approved');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Recalculate metrics after materialization
    PERFORM public.rebuild_curriculum_metrics();
    
    RETURN v_count;
END;
$function$;
