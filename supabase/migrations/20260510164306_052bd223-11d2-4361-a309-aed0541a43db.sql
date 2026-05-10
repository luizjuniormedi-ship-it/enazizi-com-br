
CREATE TABLE IF NOT EXISTS public.ai_model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  task_type text NOT NULL DEFAULT 'general',
  specialty text NOT NULL DEFAULT '',
  quality_tier text NOT NULL DEFAULT 'standard',
  cost_tier text NOT NULL DEFAULT 'medium',
  latency_tier text NOT NULL DEFAULT 'normal',
  supports_reasoning boolean NOT NULL DEFAULT false,
  supports_vision boolean NOT NULL DEFAULT false,
  supports_json boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_model_registry_unique_combo UNIQUE (provider, model, task_type, specialty)
);

CREATE INDEX IF NOT EXISTS idx_ai_model_registry_enabled
  ON public.ai_model_registry (enabled, priority);
CREATE INDEX IF NOT EXISTS idx_ai_model_registry_task
  ON public.ai_model_registry (task_type, enabled);

ALTER TABLE public.ai_model_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage AI model registry" ON public.ai_model_registry;
CREATE POLICY "Admins manage AI model registry"
  ON public.ai_model_registry
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.ai_provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  latency_ms integer,
  last_error text,
  last_error_code text,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  checked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ai_provider_health_unique_model UNIQUE (provider, model)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_health_status
  ON public.ai_provider_health (status, checked_at DESC);

ALTER TABLE public.ai_provider_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view provider health" ON public.ai_provider_health;
CREATE POLICY "Admins view provider health"
  ON public.ai_provider_health
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.ai_model_registry
  (provider, model, task_type, specialty, quality_tier, cost_tier, latency_tier, supports_reasoning, supports_vision, supports_json, enabled, priority, notes)
VALUES
  ('lovable-ai', 'google/gemini-3-flash-preview', 'general',           '',             'standard', 'low',    'low',    false, true,  true, true, 10, 'Default flash do Tutor V2'),
  ('lovable-ai', 'google/gemini-2.5-flash',       'general',           '',             'standard', 'low',    'low',    false, true,  true, true, 20, 'Fallback estável'),
  ('lovable-ai', 'google/gemini-2.5-flash-lite',  'general',           '',             'basic',    'low',    'low',    false, false, true, true, 30, 'Modo economy / cognitive load high'),
  ('lovable-ai', 'google/gemini-2.5-pro',         'lesson_generation', '',             'premium',  'medium', 'normal', true,  true,  true, true, 40, 'Aulas/CME premium'),
  ('lovable-ai', 'openai/gpt-5-mini',             'tutor_chat',        'farmacologia', 'high',     'medium', 'normal', true,  false, true, true, 50, 'Reasoning balanceado'),
  ('lovable-ai', 'openai/gpt-5',                  'tutor_chat',        '',             'premium',  'high',   'high',   true,  true,  true, true, 60, 'Reasoning premium')
ON CONFLICT ON CONSTRAINT ai_model_registry_unique_combo DO UPDATE
  SET enabled = EXCLUDED.enabled,
      quality_tier = EXCLUDED.quality_tier,
      cost_tier = EXCLUDED.cost_tier,
      latency_tier = EXCLUDED.latency_tier,
      priority = EXCLUDED.priority,
      notes = EXCLUDED.notes,
      updated_at = now();
