-- Tabela de telemetria histórica do Coverage Priority Boost
CREATE TABLE IF NOT EXISTS public.coverage_boost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recommendation_id text,
  recommendation_type text,
  topic text,
  subtopic text,
  specialty text,
  subtopic_id uuid NULL,
  topic_id uuid NULL,
  specialty_id uuid NULL,
  coverage_boost_score integer NOT NULL DEFAULT 0,
  coverage_boost_applied integer NOT NULL DEFAULT 0,
  coverage_boost_level text,
  coverage_boost_reason text,
  coverage_boost_match_method text,
  boost_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  clicked boolean NOT NULL DEFAULT false,
  clicked_at timestamptz,
  executed boolean NOT NULL DEFAULT false,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbe_user_created ON public.coverage_boost_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbe_subtopic_id ON public.coverage_boost_events (subtopic_id) WHERE subtopic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cbe_match_method ON public.coverage_boost_events (coverage_boost_match_method);
CREATE INDEX IF NOT EXISTS idx_cbe_created_at ON public.coverage_boost_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbe_recommendation ON public.coverage_boost_events (user_id, recommendation_id);

ALTER TABLE public.coverage_boost_events ENABLE ROW LEVEL SECURITY;

-- SELECT: dono ou admin
CREATE POLICY "cbe_select_own_or_admin"
  ON public.coverage_boost_events
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT: o próprio usuário pode gravar seus eventos (service role bypassa RLS)
CREATE POLICY "cbe_insert_own"
  ON public.coverage_boost_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: apenas o próprio dono pode marcar clicked/executed
CREATE POLICY "cbe_update_own"
  ON public.coverage_boost_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
