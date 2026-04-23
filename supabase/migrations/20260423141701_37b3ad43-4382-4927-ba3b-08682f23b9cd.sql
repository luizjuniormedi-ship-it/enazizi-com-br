-- 1) alias_match_events
CREATE TABLE IF NOT EXISTS public.alias_match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.question_classification_runs(id) ON DELETE CASCADE,
  table_source text NOT NULL,
  question_id uuid NOT NULL,
  original_topic text,
  normalized_topic text,
  alias_key text NOT NULL,
  alias_target text NOT NULL,
  specialty_id uuid,
  topic_id uuid,
  subtopic_id uuid,
  confidence numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alias_match_events_run
  ON public.alias_match_events(run_id);
CREATE INDEX IF NOT EXISTS idx_alias_match_events_alias
  ON public.alias_match_events(alias_key);
CREATE INDEX IF NOT EXISTS idx_alias_match_events_created
  ON public.alias_match_events(created_at DESC);

ALTER TABLE public.alias_match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alias match events"
  ON public.alias_match_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages alias match events"
  ON public.alias_match_events
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) classification_health_snapshots
CREATE TABLE IF NOT EXISTS public.classification_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.question_classification_runs(id) ON DELETE SET NULL,
  total_questions integer,
  pct_specialty numeric(5,2),
  pct_topic numeric(5,2),
  pct_subtopic numeric(5,2),
  queue_pending integer,
  deterministic_pct numeric(5,2),
  heuristic_pct numeric(5,2),
  queue_pct numeric(5,2),
  skipped_pct numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_health_snapshots_created
  ON public.classification_health_snapshots(created_at DESC);

ALTER TABLE public.classification_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view health snapshots"
  ON public.classification_health_snapshots
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages health snapshots"
  ON public.classification_health_snapshots
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) Métricas por run
ALTER TABLE public.question_classification_runs
  ADD COLUMN IF NOT EXISTS deterministic_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS heuristic_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS queue_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS skipped_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS alias_exact_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exact_text_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heuristic_count integer DEFAULT 0;

-- 4) v_alias_coverage
CREATE OR REPLACE VIEW public.v_alias_coverage AS
SELECT
  alias_key,
  alias_target,
  COUNT(*) AS total_matches,
  ROUND(AVG(confidence)::numeric, 3) AS avg_confidence,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM public.alias_match_events
GROUP BY alias_key, alias_target
ORDER BY total_matches DESC;

-- 5) v_classification_health
CREATE OR REPLACE VIEW public.v_classification_health AS
SELECT
  now() AS generated_at,
  (SELECT COUNT(*) FROM public.questions_bank) AS total_questions,
  (SELECT COUNT(*) FROM public.questions_bank WHERE specialty_id IS NOT NULL) AS with_specialty,
  (SELECT COUNT(*) FROM public.questions_bank WHERE topic_id IS NOT NULL) AS with_topic,
  (SELECT COUNT(*) FROM public.questions_bank WHERE subtopic_id IS NOT NULL) AS with_subtopic,
  (
    SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE specialty_id IS NOT NULL) / NULLIF(COUNT(*),0), 2)
    FROM public.questions_bank
  ) AS pct_specialty,
  (
    SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE topic_id IS NOT NULL) / NULLIF(COUNT(*),0), 2)
    FROM public.questions_bank
  ) AS pct_topic,
  (
    SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE subtopic_id IS NOT NULL) / NULLIF(COUNT(*),0), 2)
    FROM public.questions_bank
  ) AS pct_subtopic,
  (SELECT COUNT(*) FROM public.question_classification_queue WHERE status = 'pending') AS queue_pending,
  (SELECT COUNT(*) FROM public.question_classification_runs) AS total_runs;