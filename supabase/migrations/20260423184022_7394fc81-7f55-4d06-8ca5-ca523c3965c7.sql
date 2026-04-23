CREATE TABLE IF NOT EXISTS public.behavioral_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  entry_point text,
  action_kind text,
  route text,
  viewport text,
  ms_since_session_start int,
  pre_action_clicks int,
  pre_action_route_changes int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_behavioral_telemetry_user_created
  ON public.behavioral_telemetry (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_behavioral_telemetry_event_created
  ON public.behavioral_telemetry (event_type, created_at DESC);

ALTER TABLE public.behavioral_telemetry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_own_telemetry" ON public.behavioral_telemetry;
CREATE POLICY "users_insert_own_telemetry" ON public.behavioral_telemetry
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_read_own_telemetry" ON public.behavioral_telemetry;
CREATE POLICY "users_read_own_telemetry" ON public.behavioral_telemetry
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_read_all_telemetry" ON public.behavioral_telemetry;
CREATE POLICY "admins_read_all_telemetry" ON public.behavioral_telemetry
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.v_time_to_action_summary AS
WITH first_actions AS (
  SELECT
    user_id,
    DATE(created_at) AS day,
    viewport,
    entry_point,
    action_kind,
    route,
    ms_since_session_start,
    pre_action_clicks,
    pre_action_route_changes,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, DATE(created_at)
      ORDER BY created_at ASC
    ) AS rn
  FROM public.behavioral_telemetry
  WHERE event_type = 'first_meaningful_action'
)
SELECT
  day,
  viewport,
  entry_point,
  action_kind,
  COUNT(*) AS sessions,
  ROUND((AVG(ms_since_session_start) / 1000.0)::numeric, 1) AS avg_seconds_to_action,
  ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY ms_since_session_start) / 1000.0)::numeric, 1) AS median_seconds_to_action,
  ROUND(AVG(pre_action_clicks)::numeric, 2) AS avg_clicks_before,
  ROUND(AVG(pre_action_route_changes)::numeric, 2) AS avg_route_changes_before
FROM first_actions
WHERE rn = 1 AND ms_since_session_start IS NOT NULL
GROUP BY day, viewport, entry_point, action_kind
ORDER BY day DESC, sessions DESC;

COMMENT ON TABLE public.behavioral_telemetry IS
  'Sprint 4 - Telemetria comportamental leve. Mede tempo-ate-acao, ponto de entrada e hesitacao. RLS por user_id.';
COMMENT ON VIEW public.v_time_to_action_summary IS
  'Sprint 4 - Resumo agregado de tempo-ate-acao por dia/viewport/entry_point. Apenas primeira acao por sessao-dia.';