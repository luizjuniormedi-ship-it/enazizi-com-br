
DROP VIEW IF EXISTS public.mnemonic_utility_agg;
CREATE VIEW public.mnemonic_utility_agg
WITH (security_invoker = true) AS
SELECT
  mf.result_id,
  mr.tema,
  mr.user_id,
  COUNT(*) AS feedback_count,
  ROUND(AVG(mf.utility_score)::numeric, 1) AS avg_utility,
  ROUND(AVG(mf.rating_general)::numeric, 1) AS avg_rating,
  SUM(CASE WHEN mf.utility_score > 0 THEN 1 ELSE 0 END) AS positive_count,
  SUM(CASE WHEN mf.utility_score < 0 THEN 1 ELSE 0 END) AS negative_count,
  MAX(mf.created_at) AS last_feedback_at
FROM public.mnemonic_feedback mf
JOIN public.mnemonic_results mr ON mr.id = mf.result_id
GROUP BY mf.result_id, mr.tema, mr.user_id;
