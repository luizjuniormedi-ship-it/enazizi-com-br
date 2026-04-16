
-- Add utility_score column
ALTER TABLE public.mnemonic_feedback
  ADD COLUMN IF NOT EXISTS utility_score integer DEFAULT 0;

-- Create aggregated view for effectiveness panel
CREATE OR REPLACE VIEW public.mnemonic_utility_agg AS
SELECT
  mf.result_id,
  mr.tema,
  mr.user_id,
  COUNT(*) AS feedback_count,
  ROUND(AVG(mf.utility_score), 1) AS avg_utility,
  ROUND(AVG(mf.rating_general), 1) AS avg_rating,
  SUM(CASE WHEN mf.utility_score > 0 THEN 1 ELSE 0 END) AS positive_count,
  SUM(CASE WHEN mf.utility_score < 0 THEN 1 ELSE 0 END) AS negative_count,
  MAX(mf.created_at) AS last_feedback_at
FROM public.mnemonic_feedback mf
JOIN public.mnemonic_results mr ON mr.id = mf.result_id
GROUP BY mf.result_id, mr.tema, mr.user_id;
