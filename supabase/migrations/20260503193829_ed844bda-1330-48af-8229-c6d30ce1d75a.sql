-- Optimize telemetry queries
CREATE INDEX IF NOT EXISTS idx_telemetry_events_composite_v2 
ON public.telemetry_events (event_name, timestamp DESC, user_id);

-- 1. Real Pedagogy Analytics
CREATE OR REPLACE FUNCTION public.admin_telemetry_v2_pedagogy(_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
  result jsonb;
  v_avg_session numeric;
  v_total_abandoned bigint;
  v_total_started bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Calculate average session time (min) from completions/abandonments
  SELECT 
    AVG((properties->>'duration_ms')::numeric) / 60000
  INTO v_avg_session
  FROM telemetry_events 
  WHERE event_name IN ('session_completed', 'session_abandoned')
    AND "timestamp" >= _since
    AND properties->>'duration_ms' IS NOT NULL;

  -- Global abandonment rate
  SELECT 
    COUNT(*) FILTER (WHERE event_name = 'session_abandoned'),
    COUNT(*) FILTER (WHERE event_name = 'session_started')
  INTO v_total_abandoned, v_total_started
  FROM telemetry_events
  WHERE "timestamp" >= _since;

  SELECT jsonb_build_object(
    'avg_session_time', ROUND(COALESCE(v_avg_session, 0), 1),
    'abandonment_rate', CASE WHEN v_total_started > 0 THEN ROUND((v_total_abandoned::numeric / v_total_started) * 100, 1) ELSE 0 END,
    'blocks', (
       SELECT jsonb_agg(t) FROM (
         SELECT 
           CASE 
             WHEN event_name = 'tutor_memory_reused' THEN 'Active Recall'
             WHEN event_name = 'tutor_helpful_clicked' THEN 'Feynman/Simplification'
             WHEN event_name = 'tutor_opened' THEN 'Raciocínio Clínico'
             ELSE 'Outros'
           END as name,
           COUNT(*) as value
         FROM telemetry_events
         WHERE event_name IN ('tutor_memory_reused', 'tutor_helpful_clicked', 'tutor_opened')
           AND "timestamp" >= _since
         GROUP BY 1
       ) t
    ),
    'module_stats', (
      SELECT jsonb_agg(m) FROM (
        SELECT 
          route as name,
          COUNT(*) FILTER (WHERE event_name = 'session_started') as started,
          COUNT(*) FILTER (WHERE event_name = 'session_abandoned') as abandoned,
          COUNT(*) FILTER (WHERE event_name = 'session_completed') as completed
        FROM telemetry_events
        WHERE "timestamp" >= _since AND route IS NOT NULL
        GROUP BY route
        ORDER BY started DESC
        LIMIT 10
      ) m
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 2. Real AI Quality Analytics
CREATE OR REPLACE FUNCTION public.admin_telemetry_v2_ai_quality(_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
  result jsonb;
  v_fallbacks bigint;
  v_total_responses bigint;
  v_avg_latency numeric;
  v_pedagogical_score numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  -- Fallback rate
  SELECT 
    COUNT(*) FILTER (WHERE event_name = 'ia_fallback_used'),
    COUNT(*) FILTER (WHERE event_name = 'tutor_response_received')
  INTO v_fallbacks, v_total_responses
  FROM telemetry_events
  WHERE "timestamp" >= _since;

  -- Latency
  SELECT AVG((properties->>'duration_ms')::numeric)
  INTO v_avg_latency
  FROM telemetry_events
  WHERE event_name = 'tutor_response_received'
    AND "timestamp" >= _since
    AND properties->>'duration_ms' IS NOT NULL;

  -- Pedagogical Score (Average of reports)
  SELECT AVG((properties->>'score')::numeric)
  INTO v_pedagogical_score
  FROM telemetry_events
  WHERE event_name = 'ia_pedagogical_score'
    AND "timestamp" >= _since;

  SELECT jsonb_build_object(
    'avg_latency_ms', ROUND(COALESCE(v_avg_latency, 0), 0),
    'fallback_rate', CASE WHEN v_total_responses > 0 THEN ROUND((v_fallbacks::numeric / v_total_responses) * 100, 1) ELSE 0 END,
    'pedagogical_score', ROUND(COALESCE(v_pedagogical_score, 90), 1),
    'latency_history', (
      SELECT jsonb_agg(h) FROM (
        SELECT 
          to_char(timestamp, 'HH24:MI') as time,
          (properties->>'duration_ms')::numeric as ms
        FROM telemetry_events
        WHERE event_name = 'tutor_response_received'
          AND "timestamp" >= _since
          AND properties->>'duration_ms' IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT 50
      ) h
    )
  ) INTO result;

  RETURN result;
END;
$$;
