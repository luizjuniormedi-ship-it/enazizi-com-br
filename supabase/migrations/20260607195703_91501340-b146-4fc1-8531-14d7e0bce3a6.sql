CREATE TABLE IF NOT EXISTS public.question_impact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  qis_score NUMERIC DEFAULT 0, -- 0-100
  recovery_success_rate NUMERIC DEFAULT 0, -- % of students who corrected after error
  retention_contribution_score NUMERIC DEFAULT 0, -- Long-term memory impact
  transfer_contribution_score NUMERIC DEFAULT 0, -- Performance boost in related topics
  clinical_reasoning_impact NUMERIC DEFAULT 0, -- Simulation/Hospital Virtual impact
  approval_correlation_score NUMERIC DEFAULT 0, -- Correlation with final passing
  sample_size INTEGER DEFAULT 0,
  tier TEXT CHECK (tier IN ('GOLD', 'ACCEPT', 'REVIEW', 'QUARANTINE')),
  last_recalculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.question_drift_monitor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  board_name TEXT NOT NULL,
  drift_score INTEGER DEFAULT 0, -- 0-100 (Higher = more outdated)
  lexical_drift NUMERIC DEFAULT 0,
  cognitive_drift NUMERIC DEFAULT 0,
  structural_drift NUMERIC DEFAULT 0,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast lookup by question
CREATE INDEX IF NOT EXISTS idx_qim_question_id ON public.question_impact_metrics(question_id);
CREATE INDEX IF NOT EXISTS idx_qdm_question_id ON public.question_drift_monitor(question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_impact_metrics TO authenticated;
GRANT ALL ON public.question_impact_metrics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_drift_monitor TO authenticated;
GRANT ALL ON public.question_drift_monitor TO service_role;

ALTER TABLE public.question_impact_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_drift_monitor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view impact metrics" ON public.question_impact_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view drift data" ON public.question_drift_monitor FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access impact" ON public.question_impact_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access drift" ON public.question_drift_monitor FOR ALL TO service_role USING (true) WITH CHECK (true);
