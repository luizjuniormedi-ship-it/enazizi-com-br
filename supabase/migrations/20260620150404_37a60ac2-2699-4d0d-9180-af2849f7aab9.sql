
CREATE TABLE public.memory_consolidation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid,
  topic_label text,
  subtopic_id uuid,
  source text NOT NULL CHECK (source IN ('tutor_v3','error_review','fsrs_due','manual')),
  trigger_event_id text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  mastery_score numeric,
  confidence_score numeric,
  false_confidence_flag boolean NOT NULL DEFAULT false,
  metacog_quality numeric,
  summary_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcs_user ON public.memory_consolidation_sessions(user_id, started_at DESC);
CREATE INDEX idx_mcs_topic ON public.memory_consolidation_sessions(topic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_consolidation_sessions TO authenticated;
GRANT ALL ON public.memory_consolidation_sessions TO service_role;

ALTER TABLE public.memory_consolidation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcs_owner_select" ON public.memory_consolidation_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mcs_owner_insert" ON public.memory_consolidation_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mcs_owner_update" ON public.memory_consolidation_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.memory_consolidation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.memory_consolidation_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step text NOT NULL CHECK (step IN ('retrieval','connective_summary','metacog','confidence')),
  prompt text,
  response text,
  ai_evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcr_session ON public.memory_consolidation_responses(session_id);
CREATE INDEX idx_mcr_user ON public.memory_consolidation_responses(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_consolidation_responses TO authenticated;
GRANT ALL ON public.memory_consolidation_responses TO service_role;

ALTER TABLE public.memory_consolidation_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcr_owner_select" ON public.memory_consolidation_responses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "mcr_owner_insert" ON public.memory_consolidation_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.memory_consolidation_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid,
  topic_label text,
  window_label text NOT NULL CHECK (window_label IN ('7d','30d','90d')),
  mastery_avg numeric,
  retention_index numeric,
  false_confidence_rate numeric,
  knowledge_gap_score numeric,
  sample_size integer NOT NULL DEFAULT 0,
  is_experimental boolean NOT NULL DEFAULT true,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id, window_label)
);
CREATE INDEX idx_mcm_user ON public.memory_consolidation_metrics(user_id);

GRANT SELECT ON public.memory_consolidation_metrics TO authenticated;
GRANT ALL ON public.memory_consolidation_metrics TO service_role;

ALTER TABLE public.memory_consolidation_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcm_owner_select" ON public.memory_consolidation_metrics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mcs_updated BEFORE UPDATE ON public.memory_consolidation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mcm_updated BEFORE UPDATE ON public.memory_consolidation_metrics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.feature_flags (name, status, description, gradual_rollout_percentage)
VALUES ('memory_consolidation_enabled', 'disabled', 'Sprint 1 Memory Consolidation Engine — staged rollout 10/50/100%', 0)
ON CONFLICT DO NOTHING;
