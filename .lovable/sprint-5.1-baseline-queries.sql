-- ============================================================================
-- Sprint 5.1 — Baseline Comportamental Oficial
-- ============================================================================
-- Rodar como ADMIN quando os critérios de volume forem atingidos:
--   - >= 7 dias de coleta
--   - >= 100 sessions
--   - >= 30 first_meaningful_action
--   - >= 10 usuários distintos
--   - mobile e desktop ambos representados
--
-- Read-only. Idempotente. Sem efeitos colaterais.
-- Cada bloco produz UMA das 7 métricas classificáveis do contrato
-- (ver .lovable/sprint-5.1-baseline-contract.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. PRÉ-CHECK: a baseline pode ser publicada?
-- ----------------------------------------------------------------------------
SELECT
  COUNT(DISTINCT user_id)                                          AS users,
  COUNT(*) FILTER (WHERE event_type='session_start')               AS sessions,
  COUNT(*) FILTER (WHERE event_type='first_meaningful_action')     AS first_actions,
  EXTRACT(DAY FROM (now() - MIN(created_at)))                      AS days_collected,
  COUNT(DISTINCT viewport)                                         AS viewports_seen,
  CASE
    WHEN COUNT(DISTINCT user_id) >= 10
     AND COUNT(*) FILTER (WHERE event_type='session_start') >= 100
     AND COUNT(*) FILTER (WHERE event_type='first_meaningful_action') >= 30
     AND EXTRACT(DAY FROM (now() - MIN(created_at))) >= 7
     AND COUNT(DISTINCT viewport) >= 2
    THEN '✅ pronto para baseline'
    ELSE '⏳ aguardando mais dados'
  END AS baseline_status
FROM behavioral_telemetry;

-- ----------------------------------------------------------------------------
-- A + B. Tempo-até-ação: mediana, média, p95 (global e por viewport)
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(viewport, 'all') AS viewport,
  COUNT(*)                                                                              AS n,
  ROUND(AVG(ms_since_session_start) / 1000.0, 1)                                        AS mean_seconds,
  ROUND(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY ms_since_session_start) / 1000.0, 1) AS median_seconds,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ms_since_session_start) / 1000.0, 1) AS p95_seconds
FROM behavioral_telemetry
WHERE event_type='first_meaningful_action'
  AND ms_since_session_start IS NOT NULL
GROUP BY ROLLUP(viewport)
ORDER BY viewport NULLS LAST;

-- ----------------------------------------------------------------------------
-- C. Cliques antes da ação: média + distribuição
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(viewport, 'all') AS viewport,
  COUNT(*)                                                                                AS n,
  ROUND(AVG(pre_action_clicks)::numeric, 2)                                               AS mean_clicks,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pre_action_clicks)                          AS median_clicks,
  MAX(pre_action_clicks)                                                                  AS max_clicks
FROM behavioral_telemetry
WHERE event_type='first_meaningful_action'
GROUP BY ROLLUP(viewport)
ORDER BY viewport NULLS LAST;

-- ----------------------------------------------------------------------------
-- D + F. Trocas de rota: média e % de sessões com >=4 (loops)
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(viewport, 'all') AS viewport,
  COUNT(*)                                                                                                       AS n,
  ROUND(AVG(pre_action_route_changes)::numeric, 2)                                                               AS mean_route_changes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE pre_action_route_changes >= 4)::numeric / NULLIF(COUNT(*), 0), 1)         AS pct_loops_4plus
FROM behavioral_telemetry
WHERE event_type='first_meaningful_action'
GROUP BY ROLLUP(viewport)
ORDER BY viewport NULLS LAST;

-- ----------------------------------------------------------------------------
-- E. Taxa de abandono (session_start sem ação em 30min)
-- ----------------------------------------------------------------------------
WITH starts AS (
  SELECT user_id, viewport, created_at AS started_at
  FROM behavioral_telemetry WHERE event_type='session_start'
),
matched AS (
  SELECT s.*,
         EXISTS (
           SELECT 1 FROM behavioral_telemetry a
           WHERE a.user_id = s.user_id
             AND a.event_type = 'first_meaningful_action'
             AND a.created_at BETWEEN s.started_at AND s.started_at + INTERVAL '30 min'
         ) AS converted
  FROM starts s
)
SELECT
  COALESCE(viewport, 'all') AS viewport,
  COUNT(*)                                                                       AS sessions,
  COUNT(*) FILTER (WHERE NOT converted)                                          AS abandoned,
  ROUND(100.0 * COUNT(*) FILTER (WHERE NOT converted)::numeric / NULLIF(COUNT(*), 0), 1) AS abandon_pct
FROM matched
GROUP BY ROLLUP(viewport)
ORDER BY viewport NULLS LAST;

-- ----------------------------------------------------------------------------
-- DISTRIBUIÇÃO DE ENTRY POINTS (descritivo, sem classificação)
-- ----------------------------------------------------------------------------
SELECT
  COALESCE(entry_point, '(none)') AS entry_point,
  COUNT(*)                                                                                                AS first_actions,
  ROUND(100.0 * COUNT(*)::numeric / SUM(COUNT(*)) OVER (), 1)                                             AS share_pct,
  ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms_since_session_start)) / 1000.0, 1)                AS median_seconds_to_action
FROM behavioral_telemetry
WHERE event_type='first_meaningful_action'
GROUP BY entry_point
ORDER BY first_actions DESC;

-- ----------------------------------------------------------------------------
-- G. Delta mobile vs desktop (mediana)
-- ----------------------------------------------------------------------------
WITH per_view AS (
  SELECT viewport,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms_since_session_start) / 1000.0 AS median_seconds
  FROM behavioral_telemetry
  WHERE event_type='first_meaningful_action' AND ms_since_session_start IS NOT NULL
  GROUP BY viewport
)
SELECT
  ROUND((SELECT median_seconds FROM per_view WHERE viewport='mobile')::numeric, 1)  AS mobile_median,
  ROUND((SELECT median_seconds FROM per_view WHERE viewport='desktop')::numeric, 1) AS desktop_median,
  ROUND(
    100.0 * (
      (SELECT median_seconds FROM per_view WHERE viewport='mobile')
      - (SELECT median_seconds FROM per_view WHERE viewport='desktop')
    ) / NULLIF((SELECT median_seconds FROM per_view WHERE viewport='desktop'), 0)
  , 1) AS mobile_overhead_pct;
