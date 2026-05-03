-- Drop existing functions to avoid parameter conflict
DROP FUNCTION IF EXISTS public.admin_telemetry_v2_pedagogy(integer);
DROP FUNCTION IF EXISTS public.admin_telemetry_v2_ai_quality(integer);

-- Enhance telemetry_events table
ALTER TABLE public.telemetry_events 
ADD COLUMN IF NOT EXISTS scroll_depth INTEGER,
ADD COLUMN IF NOT EXISTS time_to_first_block INTEGER;

-- Recreate Pedagogy Analytics Function
CREATE OR REPLACE FUNCTION public.admin_telemetry_v2_pedagogy(_days integer)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  start_date timestamp with time zone;
BEGIN
  start_date := now() - (_days || ' days')::interval;

  WITH stats AS (
    SELECT 
      COALESCE(AVG(EXTRACT(EPOCH FROM (timestamp - first_event_time)) / 60), 0) as avg_min
    FROM (
      SELECT session_id, MIN(timestamp) as first_event_time, MAX(timestamp) as timestamp
      FROM telemetry_events
      WHERE timestamp >= start_date
      GROUP BY session_id
    ) s
  ),
  abandonment AS (
    SELECT 
      (COUNT(*) FILTER (WHERE event_name = 'session_abandoned')::float / 
       NULLIF(COUNT(*) FILTER (WHERE event_name = 'session_started'), 0)::float * 100) as rate
    FROM telemetry_events
    WHERE timestamp >= start_date
  ),
  module_engagement AS (
    SELECT 
      route as name,
      COUNT(*) FILTER (WHERE event_name = 'session_started' OR event_name = 'dashboard_opened') as started,
      COUNT(*) FILTER (WHERE event_name = 'session_abandoned') as abandoned
    FROM telemetry_events
    WHERE timestamp >= start_date AND route IS NOT NULL
    GROUP BY route
    ORDER BY started DESC
    LIMIT 10
  ),
  pedagogical_blocks AS (
    SELECT 
      CASE 
        WHEN event_name = 'tutor_message_sent' THEN 'Interação IA'
        WHEN event_name = 'tutor_quiz_answered' THEN 'Active Recall'
        WHEN event_name = 'tutor_helpful_clicked' THEN 'Feedback Positivo'
        ELSE 'Outros'
      END as name,
      COUNT(*) as value
    FROM telemetry_events
    WHERE timestamp >= start_date 
    AND event_name IN ('tutor_message_sent', 'tutor_quiz_answered', 'tutor_helpful_clicked')
    GROUP BY name
  )
  SELECT jsonb_build_object(
    'avg_session_time', ROUND(COALESCE((SELECT avg_min FROM stats), 0)::numeric, 1),
    'abandonment_rate', ROUND(COALESCE((SELECT rate FROM abandonment), 0)::numeric, 1),
    'moduleStats', COALESCE((SELECT jsonb_agg(m) FROM module_engagement m), '[]'::jsonb),
    'blocks', COALESCE((SELECT jsonb_agg(b) FROM pedagogical_blocks b), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate AI Quality Function
CREATE OR REPLACE FUNCTION public.admin_telemetry_v2_ai_quality(_days integer)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  start_date timestamp with time zone;
BEGIN
  start_date := now() - (_days || ' days')::interval;

  WITH latency AS (
    SELECT 
      AVG((properties->>'latency_ms')::numeric) as avg_ms,
      (COUNT(*) FILTER (WHERE event_name = 'ia_fallback_used')::float / 
       NULLIF(COUNT(*) FILTER (WHERE event_name IN ('tutor_response_received', 'ia_fallback_used')), 0)::float * 100) as fallback_rate
    FROM telemetry_events
    WHERE timestamp >= start_date
  ),
  history AS (
    SELECT 
      to_char(timestamp, 'HH24:MI') as time,
      (properties->>'latency_ms')::numeric as ms
    FROM telemetry_events
    WHERE timestamp >= start_date AND event_name = 'edge_function_latency'
    ORDER BY timestamp DESC
    LIMIT 50
  ),
  scores AS (
    SELECT 
      AVG((properties->>'score')::numeric) as avg_score
    FROM telemetry_events
    WHERE timestamp >= start_date AND event_name = 'ia_pedagogical_score'
  )
  SELECT jsonb_build_object(
    'avg_latency_ms', ROUND(COALESCE((SELECT avg_ms FROM latency), 0)::numeric, 0),
    'fallback_rate', ROUND(COALESCE((SELECT fallback_rate FROM latency), 0)::numeric, 1),
    'pedagogical_score', ROUND(COALESCE((SELECT avg_score FROM scores), 85)::numeric, 0),
    'latency_history', COALESCE((SELECT jsonb_agg(h) FROM (SELECT * FROM history ORDER BY time ASC) h), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
