-- Sprint 5: Views analíticas para detectar hesitação cognitiva.
-- Todas as views são security_invoker para herdar a RLS de behavioral_telemetry,
-- mas adicionamos uma policy explícita "admin can read all" para análise agregada.

-- 1) Garantir que admin pode ler todos os eventos (necessário para agregação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'behavioral_telemetry'
      AND policyname = 'Admins can read all telemetry'
  ) THEN
    CREATE POLICY "Admins can read all telemetry"
    ON public.behavioral_telemetry
    FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;

-- 2) View: hesitação por rota inicial (apenas first_meaningful_action)
CREATE OR REPLACE VIEW public.v_hesitation_by_route
WITH (security_invoker = true) AS
SELECT
  COALESCE(route, '(unknown)')                              AS route,
  COALESCE(viewport, 'desktop')                             AS viewport,
  COUNT(*)                                                  AS sessions,
  ROUND(AVG(ms_since_session_start)::numeric / 1000.0, 1)   AS avg_seconds_to_action,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms_since_session_start))::numeric / 1000.0, 1) AS median_seconds_to_action,
  ROUND(AVG(pre_action_clicks)::numeric, 2)                 AS avg_clicks_before,
  ROUND(AVG(pre_action_route_changes)::numeric, 2)          AS avg_route_changes_before,
  MIN(created_at)::date                                     AS since
FROM public.behavioral_telemetry
WHERE event_type = 'first_meaningful_action'
  AND ms_since_session_start IS NOT NULL
GROUP BY 1, 2;

-- 3) View: eficiência por entry_point
CREATE OR REPLACE VIEW public.v_hesitation_by_entry_point
WITH (security_invoker = true) AS
SELECT
  COALESCE(entry_point, '(none)')                           AS entry_point,
  COALESCE(viewport, 'desktop')                             AS viewport,
  COUNT(*)                                                  AS sessions,
  ROUND(AVG(ms_since_session_start)::numeric / 1000.0, 1)   AS avg_seconds_to_action,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms_since_session_start))::numeric / 1000.0, 1) AS median_seconds_to_action,
  ROUND(AVG(pre_action_clicks)::numeric, 2)                 AS avg_clicks_before,
  ROUND(AVG(pre_action_route_changes)::numeric, 2)          AS avg_route_changes_before
FROM public.behavioral_telemetry
WHERE event_type = 'first_meaningful_action'
  AND ms_since_session_start IS NOT NULL
GROUP BY 1, 2;

-- 4) View: sessões abandonadas (start sem ação real em 30 min)
CREATE OR REPLACE VIEW public.v_abandoned_sessions
WITH (security_invoker = true) AS
WITH starts AS (
  SELECT user_id, route AS entry_route, viewport, created_at AS started_at
  FROM public.behavioral_telemetry
  WHERE event_type = 'session_start'
),
actions AS (
  SELECT user_id, created_at AS action_at
  FROM public.behavioral_telemetry
  WHERE event_type = 'first_meaningful_action'
)
SELECT
  s.user_id,
  s.entry_route,
  s.viewport,
  s.started_at,
  s.started_at::date AS day
FROM starts s
WHERE NOT EXISTS (
  SELECT 1 FROM actions a
  WHERE a.user_id = s.user_id
    AND a.action_at >= s.started_at
    AND a.action_at <= s.started_at + INTERVAL '30 minutes'
);

-- 5) View: loops de navegação (>=4 trocas de rota antes da ação)
CREATE OR REPLACE VIEW public.v_navigation_loops
WITH (security_invoker = true) AS
SELECT
  user_id,
  route                       AS final_route,
  entry_point,
  viewport,
  pre_action_route_changes,
  pre_action_clicks,
  ROUND(ms_since_session_start::numeric / 1000.0, 1) AS seconds_to_action,
  created_at::date            AS day,
  created_at
FROM public.behavioral_telemetry
WHERE event_type = 'first_meaningful_action'
  AND COALESCE(pre_action_route_changes, 0) >= 4;

-- 6) View: ranking de eficiência (rotas + entry_points)
CREATE OR REPLACE VIEW public.v_route_efficiency_ranking
WITH (security_invoker = true) AS
SELECT
  COALESCE(route, '(unknown)')                              AS route,
  COALESCE(entry_point, '(none)')                           AS entry_point,
  COUNT(*)                                                  AS sessions,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms_since_session_start))::numeric / 1000.0, 1) AS median_seconds,
  ROUND(AVG(pre_action_clicks)::numeric, 2)                 AS avg_clicks,
  ROUND(AVG(pre_action_route_changes)::numeric, 2)          AS avg_route_changes,
  -- score composto: quanto menor, mais eficiente
  ROUND(
    (COALESCE(AVG(ms_since_session_start), 0) / 1000.0)
    + (COALESCE(AVG(pre_action_clicks), 0) * 2.0)
    + (COALESCE(AVG(pre_action_route_changes), 0) * 5.0)
  , 2) AS friction_score
FROM public.behavioral_telemetry
WHERE event_type = 'first_meaningful_action'
  AND ms_since_session_start IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) >= 1;

COMMENT ON VIEW public.v_hesitation_by_route          IS 'Sprint 5: tempo/cliques/rotas até ação por rota inicial.';
COMMENT ON VIEW public.v_hesitation_by_entry_point    IS 'Sprint 5: eficiência por ponto de entrada (Visão Geral, Estudar, ENAFLIX, IA).';
COMMENT ON VIEW public.v_abandoned_sessions           IS 'Sprint 5: sessões iniciadas sem ação pedagógica em 30 min.';
COMMENT ON VIEW public.v_navigation_loops             IS 'Sprint 5: sessões com 4+ trocas de rota antes da primeira ação (indecisão).';
COMMENT ON VIEW public.v_route_efficiency_ranking     IS 'Sprint 5: ranking de fricção composto (tempo + cliques*2 + rotas*5).';