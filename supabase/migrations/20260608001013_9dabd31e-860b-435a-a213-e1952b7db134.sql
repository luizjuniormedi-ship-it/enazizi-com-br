CREATE OR REPLACE FUNCTION public.rebuild_curriculum_metrics()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
BEGIN
    -- Update visible_questions and CCS
    UPDATE public.curriculum_topics t
    SET 
        visible_questions = (
            SELECT count(*) 
            FROM public.questions_bank q 
            WHERE q.topic_id = t.id 
            AND q.review_status = 'approved'
        ),
        ccs_score = (
            SELECT COALESCE(avg(classification_confidence), 0) -- 0-1 range to fit numeric(5,4)
            FROM public.questions_bank q 
            WHERE q.topic_id = t.id 
            AND q.review_status = 'approved'
        ),
        rvs_score = ( 
            SELECT COALESCE(
                (MAX(comp_count)::numeric / NULLIF(SUM(comp_count), 0)::numeric) * 100, 
                0
            )
            FROM (
                SELECT competency_id, count(*) as comp_count
                FROM public.questions_bank q
                WHERE q.topic_id = t.id
                GROUP BY competency_id
            ) sub
        );
    
    -- RPS (Relative Pedagogical Strength) - 20 questions is the goal for "strong" topic
    UPDATE public.curriculum_topics 
    SET rps = LEAST((visible_questions::numeric / 20.0) * 100, 100)
    WHERE visible_questions > 0;

    -- Update status
    UPDATE public.curriculum_topics
    SET status = CASE 
        WHEN visible_questions >= 10 THEN 'operational'
        WHEN visible_questions > 0 THEN 'insufficient'
        ELSE 'empty'
    END;
END;
$function$;
