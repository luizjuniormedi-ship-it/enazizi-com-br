CREATE OR REPLACE FUNCTION public.get_unclassified_questions(p_limit integer)
 RETURNS TABLE(id uuid, statement text, explanation text, topic text, subtopic text)
 LANGUAGE plpgsql
 AS $function$
BEGIN
    RETURN QUERY
    SELECT q.id, q.statement, q.explanation, q.topic, q.subtopic
    FROM public.questions_bank q
    LEFT JOIN public.question_classification_staging s ON q.id = s.question_id
    WHERE q.topic_id IS NULL 
      AND s.question_id IS NULL
    LIMIT p_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_unclassified_questions TO service_role;
GRANT EXECUTE ON FUNCTION public.get_unclassified_questions TO authenticated;
