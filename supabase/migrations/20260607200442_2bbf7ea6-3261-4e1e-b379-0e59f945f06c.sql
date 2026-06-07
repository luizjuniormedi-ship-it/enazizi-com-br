CREATE TABLE IF NOT EXISTS public.outcome_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  question_id UUID REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  exam_type TEXT CHECK (exam_type IN ('ENARE', 'ENAMED', 'UNIVERSITY', 'OSCE', 'INTERNATO')),
  exam_date DATE,
  exam_score NUMERIC,
  approval_status BOOLEAN,
  source TEXT,
  confidence_level TEXT DEFAULT 'LOW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.question_impact_metrics 
ADD COLUMN IF NOT EXISTS ois_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS observation_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS survival_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reevaluated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

ALTER TABLE public.question_impact_metrics 
DROP CONSTRAINT IF EXISTS question_impact_metrics_tier_check;

ALTER TABLE public.question_impact_metrics 
ADD CONSTRAINT question_impact_metrics_tier_check 
CHECK (tier IN ('GOLD_VERIFIED_EMPIRICAL', 'GOLD_VERIFIED_HIGH_CONFIDENCE', 'GOLD_VERIFIED', 'GOLD', 'ACCEPT', 'REVIEW', 'QUARANTINE'));

CREATE INDEX IF NOT EXISTS idx_outcome_registry_user ON public.outcome_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_outcome_registry_question ON public.outcome_registry(question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outcome_registry TO authenticated;
GRANT ALL ON public.outcome_registry TO service_role;

ALTER TABLE public.outcome_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own outcome reports" ON public.outcome_registry FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access outcome" ON public.outcome_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
