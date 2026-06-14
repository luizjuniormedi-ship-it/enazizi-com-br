-- ─── TOPIC FIDELITY TELEMETRY (Fase 1+2 — observacional) ─────────────────────
CREATE TABLE IF NOT EXISTS public.topic_fidelity_telemetry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  source TEXT NOT NULL,
  raw_input TEXT NOT NULL,
  resolved_specialty TEXT,
  resolved_system TEXT,
  resolved_topic TEXT,
  resolved_subtopic TEXT,
  granularity_level SMALLINT NOT NULL DEFAULT 0,
  is_generic BOOLEAN NOT NULL DEFAULT false,
  is_granular BOOLEAN NOT NULL DEFAULT false,
  was_blocked BOOLEAN NOT NULL DEFAULT false,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0,
  matched_via TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.topic_fidelity_telemetry TO authenticated;
GRANT ALL ON public.topic_fidelity_telemetry TO service_role;

ALTER TABLE public.topic_fidelity_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tft_insert_authenticated"
  ON public.topic_fidelity_telemetry
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "tft_select_own"
  ON public.topic_fidelity_telemetry
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "tft_select_admin"
  ON public.topic_fidelity_telemetry
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_tft_created_at ON public.topic_fidelity_telemetry (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tft_source_generic ON public.topic_fidelity_telemetry (source, is_generic);
CREATE INDEX IF NOT EXISTS idx_tft_user ON public.topic_fidelity_telemetry (user_id, created_at DESC);

-- Feature flag (idempotente) — desligar para parar coleta sem deploy
INSERT INTO public.system_flags (flag_key, enabled, description)
VALUES ('TOPIC_FIDELITY_TELEMETRY', true, 'Coleta observacional de granularidade de tópico (Topic Fidelity Sprint V1, Fase 2). Não bloqueia nada.')
ON CONFLICT (flag_key) DO NOTHING;