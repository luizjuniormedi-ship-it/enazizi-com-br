-- Tabela de telemetria de alertas (Fase 4 do Alert Orchestrator)
CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  alert_id text NOT NULL,
  source text NOT NULL,
  priority text NOT NULL,
  layer text NOT NULL,
  event_type text NOT NULL,
  dedupe_key text NULL,
  suppressed_by text NULL,
  legacy_origin text NULL,
  via_bridge boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas analíticas
CREATE INDEX IF NOT EXISTS idx_alert_events_user_created
  ON public.alert_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_source_created
  ON public.alert_events (source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_events_event_type
  ON public.alert_events (event_type);

CREATE INDEX IF NOT EXISTS idx_alert_events_priority_layer
  ON public.alert_events (priority, layer);

CREATE INDEX IF NOT EXISTS idx_alert_events_dedupe_key
  ON public.alert_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Validação leve dos enums (mantém flexibilidade futura)
ALTER TABLE public.alert_events
  ADD CONSTRAINT alert_events_priority_check
  CHECK (priority IN ('critical', 'important', 'contextual', 'informational'));

ALTER TABLE public.alert_events
  ADD CONSTRAINT alert_events_layer_check
  CHECK (layer IN ('structural', 'contextual', 'ephemeral', 'deep'));

ALTER TABLE public.alert_events
  ADD CONSTRAINT alert_events_event_type_check
  CHECK (event_type IN ('exposed', 'clicked', 'dismissed', 'suppressed', 'auto_hidden', 'expired'));

-- RLS
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem inserir seus próprios eventos
CREATE POLICY "Users can insert their own alert events"
  ON public.alert_events
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Permite inserts anônimos do sistema (sem user_id) — útil para eventos pré-login
CREATE POLICY "System can insert anonymous alert events"
  ON public.alert_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL);

-- Usuários leem apenas seus próprios eventos
CREATE POLICY "Users can read their own alert events"
  ON public.alert_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins leem todos os eventos (para o painel de validação)
CREATE POLICY "Admins can read all alert events"
  ON public.alert_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));