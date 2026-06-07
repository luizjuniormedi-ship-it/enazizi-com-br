CREATE TABLE IF NOT EXISTS public.question_forensics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  quality_tier TEXT CHECK (quality_tier IN ('GOLD', 'ACCEPT', 'REVIEW', 'QUARANTINE')),
  fidelity_score INTEGER, -- 0-100
  discrimination_index NUMERIC,
  success_rate_high_performers NUMERIC,
  success_rate_low_performers NUMERIC,
  avg_response_time_seconds NUMERIC,
  distractor_fatigue_score INTEGER, -- 0-100
  medical_accuracy_status TEXT CHECK (medical_accuracy_status IN ('VERIFIED', 'SUSPECT', 'ERROR')),
  enamed_fidelity_score INTEGER,
  clinical_reasoning_score INTEGER,
  commentary_quality_tier TEXT CHECK (commentary_quality_tier IN ('GOLD', 'ACCEPT', 'POOR')),
  audited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.topic_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  requested_topic TEXT,
  canonical_topic TEXT,
  curriculum_competency TEXT,
  matched_question_ids UUID[],
  insufficient_bank_flag BOOLEAN DEFAULT false,
  correlation_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_forensics TO authenticated;
GRANT ALL ON public.question_forensics TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_generation_logs TO authenticated;
GRANT ALL ON public.topic_generation_logs TO service_role;

ALTER TABLE public.question_forensics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view forensic data" ON public.question_forensics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view their own generation logs" ON public.topic_generation_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage forensic data" ON public.question_forensics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage generation logs" ON public.topic_generation_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
