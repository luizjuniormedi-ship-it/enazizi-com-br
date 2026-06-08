-- MCME Phase 5: Rebuild Global Metrics Function
DROP FUNCTION IF EXISTS public.rebuild_curriculum_metrics();

CREATE OR REPLACE FUNCTION public.rebuild_curriculum_metrics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    total_materialized integer;
    total_eligible integer;
    v_total_questions integer;
    v_green_competencies integer;
BEGIN
    -- 1. Sync visible_questions in curriculum_topics from questions_bank
    UPDATE public.curriculum_topics ct
    SET visible_questions = (
        SELECT count(*) 
        FROM public.questions_bank qb 
        WHERE qb.topic_id = ct.id 
          AND qb.approved_for_generation = true
    );

    -- 2. Calculate CTS (Curriculum Traceability Score)
    -- Total approved questions that have full materialization (topic + competency)
    SELECT count(*) INTO total_materialized 
    FROM public.questions_bank 
    WHERE approved_for_generation = true 
      AND topic_id IS NOT NULL 
      AND competency_id IS NOT NULL;

    -- Total questions approved for generation
    SELECT count(*) INTO total_eligible 
    FROM public.questions_bank 
    WHERE approved_for_generation = true;

    -- 3. Calculate CCS (Curriculum Coverage Score)
    -- Count of topics with at least 10 questions (operational)
    SELECT count(*) INTO v_green_competencies
    FROM public.curriculum_topics
    WHERE visible_questions >= 10;

    SELECT count(*) INTO v_total_questions
    FROM public.questions_bank;

    SELECT json_build_object(
        'materialized_count', total_materialized,
        'eligible_count', total_eligible,
        'cts', CASE WHEN total_eligible > 0 THEN ROUND((total_materialized::numeric / total_eligible::numeric) * 100, 2) ELSE 0 END,
        'ccs', CASE WHEN (SELECT count(*) FROM public.curriculum_topics) > 0 THEN ROUND((v_green_competencies::numeric / (SELECT count(*) FROM public.curriculum_topics)::numeric) * 100, 2) ELSE 0 END,
        'total_questions_bank', v_total_questions,
        'timestamp', now()
    ) INTO result;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_curriculum_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_curriculum_metrics() TO service_role;
