CREATE TABLE IF NOT EXISTS public.question_external_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  eis_score NUMERIC DEFAULT 0, -- External Impact Score (0-100)
  blind_sim_performance NUMERIC DEFAULT 0, -- Success in novel/external questions
  far_transfer_score NUMERIC DEFAULT 0, -- Success in distant clinical scenarios
  hospital_virtual_impact NUMERIC DEFAULT 0, -- Performance in simulations
  long_term_retention_d180 NUMERIC DEFAULT 0, -- Retention at 180 days
  external_source_correlation NUMERIC DEFAULT 0, -- Correlation with external exams
  last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Update tier constraint to include GOLD_VERIFIED
ALTER TABLE public.question_impact_metrics 
DROP CONSTRAINT IF EXISTS question_impact_metrics_tier_check;

ALTER TABLE public.question_impact_metrics 
ADD CONSTRAINT question_impact_metrics_tier_check 
CHECK (tier IN ('GOLD_VERIFIED', 'GOLD', 'ACCEPT', 'REVIEW', 'QUARANTINE'));

CREATE INDEX IF NOT EXISTS idx_qem_question_id ON public.question_external_metrics(question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_external_metrics TO authenticated;
GRANT ALL ON public.question_external_metrics TO service_role;

ALTER TABLE public.question_external_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view external metrics" ON public.question_external_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access external" ON public.question_external_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
