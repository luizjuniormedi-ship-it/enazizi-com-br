CREATE OR REPLACE FUNCTION public.get_questions_topic_counts()
RETURNS TABLE (topic TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT topic, count(*) as count
  FROM questions_bank
  WHERE is_global = true
  GROUP BY topic;
$$;

GRANT EXECUTE ON FUNCTION public.get_questions_topic_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_questions_topic_counts() TO service_role;
