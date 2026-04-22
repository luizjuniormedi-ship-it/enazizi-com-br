-- Sprint 4 — Granular generator: observability + feature flag (default OFF)

CREATE TABLE IF NOT EXISTS public.granular_generator_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL,
  pipeline_used text NOT NULL CHECK (pipeline_used IN ('granular', 'legacy')),
  banca text,
  banca_status text,
  requested_specialties text[],
  requested_count integer,
  generated_count integer,
  topic_distribution jsonb DEFAULT '{}'::jsonb,
  fallback_triggered boolean NOT NULL DEFAULT false,
  fallback_reason text,
  duration_ms integer,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'fallback', 'error')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_granular_runs_created ON public.granular_generator_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_granular_runs_pipeline ON public.granular_generator_runs(pipeline_used, status);
CREATE INDEX IF NOT EXISTS idx_granular_runs_banca ON public.granular_generator_runs(banca);

ALTER TABLE public.granular_generator_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view granular generator runs"
  ON public.granular_generator_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert granular generator runs"
  ON public.granular_generator_runs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.system_flags (flag_key, enabled, description, category, rollout_mode)
VALUES (
  'granular_generator_enabled',
  false,
  'Sprint 4: gerador granular de simulados (distribuição por topic via curriculum_weights). Desligado por padrão. Só atua quando a banca está com status pronta.',
  'generator',
  'admins_only'
)
ON CONFLICT (flag_key) DO NOTHING;