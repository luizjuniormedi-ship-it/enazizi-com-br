-- 1) Permite admins lerem toda a telemetria
DROP POLICY IF EXISTS "Admins can read all telemetry" ON public.telemetry_events;
CREATE POLICY "Admins can read all telemetry"
ON public.telemetry_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON public.telemetry_events ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_route ON public.telemetry_events (route);
CREATE INDEX IF NOT EXISTS idx_telemetry_device ON public.telemetry_events (device_type);

-- 3) Funil de conversão
CREATE OR REPLACE FUNCTION public.admin_telemetry_funnel(_days integer DEFAULT 7)
RETURNS TABLE(stage text, value bigint, "order" int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT 'Hoje'::text, COUNT(DISTINCT session_id), 1
    FROM telemetry_events WHERE event_name='dashboard_opened' AND "timestamp">=_since
  UNION ALL
  SELECT 'Estudo iniciado', COUNT(DISTINCT session_id), 2
    FROM telemetry_events WHERE event_name='study_session_started' AND "timestamp">=_since
  UNION ALL
  SELECT 'Primeira questão', COUNT(DISTINCT session_id), 3
    FROM telemetry_events WHERE event_name='first_question_loaded' AND "timestamp">=_since
  UNION ALL
  SELECT 'Resposta submetida', COUNT(DISTINCT session_id), 4
    FROM telemetry_events WHERE event_name='first_answer_submitted' AND "timestamp">=_since
  UNION ALL
  SELECT 'Concluído', COUNT(DISTINCT session_id), 5
    FROM telemetry_events WHERE event_name='study_session_completed' AND "timestamp">=_since
  ORDER BY 3;
END $$;

-- 4) Coortes por device / rota / modo
CREATE OR REPLACE FUNCTION public.admin_telemetry_cohorts(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN jsonb_build_object(
    'by_device', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'device', COALESCE(device_type,'unknown'),
        'sessions', COUNT(DISTINCT session_id),
        'events', COUNT(*),
        'study_started', COUNT(*) FILTER (WHERE event_name='study_session_started'),
        'first_question', COUNT(*) FILTER (WHERE event_name='first_question_loaded'),
        'rage_clicks', COUNT(*) FILTER (WHERE event_name='rage_click_detected')
      ))
      FROM telemetry_events WHERE "timestamp">=_since
      GROUP BY COALESCE(device_type,'unknown')
    ), '[]'::jsonb),
    'by_route', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT route, COUNT(*) AS events, COUNT(DISTINCT session_id) AS sessions,
               COUNT(*) FILTER (WHERE event_name='rage_click_detected') AS rage_clicks
        FROM telemetry_events WHERE "timestamp">=_since AND route IS NOT NULL
        GROUP BY route ORDER BY events DESC LIMIT 25
      ) t
    ), '[]'::jsonb),
    'new_vs_recurrent', COALESCE((
      WITH first_seen AS (
        SELECT user_id, MIN("timestamp") AS first_at
        FROM telemetry_events GROUP BY user_id
      )
      SELECT jsonb_build_object(
        'novos', COUNT(*) FILTER (WHERE f.first_at >= _since),
        'recorrentes', COUNT(*) FILTER (WHERE f.first_at < _since)
      ) FROM first_seen f
    ), '{}'::jsonb)
  );
END $$;

-- 5) Qualidade do Tutor
CREATE OR REPLACE FUNCTION public.admin_telemetry_tutor_quality(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
DECLARE c_opened bigint; c_sent bigint; c_recv bigint; c_regen bigint; c_reuse bigint;
        c_quiz bigint; c_help bigint; c_unhelp bigint; c_aband bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT
    COUNT(*) FILTER (WHERE event_name='tutor_opened'),
    COUNT(*) FILTER (WHERE event_name='tutor_message_sent'),
    COUNT(*) FILTER (WHERE event_name='tutor_response_received'),
    COUNT(*) FILTER (WHERE event_name='tutor_response_regenerated'),
    COUNT(*) FILTER (WHERE event_name='tutor_memory_reused'),
    COUNT(*) FILTER (WHERE event_name='tutor_quiz_answered'),
    COUNT(*) FILTER (WHERE event_name='tutor_helpful_clicked'),
    COUNT(*) FILTER (WHERE event_name='tutor_unhelpful_clicked'),
    COUNT(*) FILTER (WHERE event_name='tutor_abandoned_after_response')
  INTO c_opened, c_sent, c_recv, c_regen, c_reuse, c_quiz, c_help, c_unhelp, c_aband
  FROM telemetry_events WHERE "timestamp">=_since;

  RETURN jsonb_build_object(
    'opened', c_opened,
    'message_sent', c_sent,
    'response_received', c_recv,
    'regeneration_rate', CASE WHEN c_recv>0 THEN ROUND((c_regen::numeric/c_recv)*100,1) ELSE 0 END,
    'memory_reuse_rate', CASE WHEN c_recv>0 THEN ROUND((c_reuse::numeric/c_recv)*100,1) ELSE 0 END,
    'helpful_rate', CASE WHEN (c_help+c_unhelp)>0 THEN ROUND((c_help::numeric/(c_help+c_unhelp))*100,1) ELSE 0 END,
    'abandon_after_response', c_aband,
    'quiz_answered', c_quiz,
    'avg_response_ms', COALESCE((
      SELECT ROUND(AVG((properties->>'response_ms')::numeric))
      FROM telemetry_events
      WHERE event_name='tutor_response_received' AND "timestamp">=_since
        AND (properties->>'response_ms') ~ '^\d+(\.\d+)?$'
    ), 0)
  );
END $$;

-- 6) Heatmap comportamental
CREATE OR REPLACE FUNCTION public.admin_telemetry_heatmap(_days integer DEFAULT 7)
RETURNS TABLE(route text, event_name text, click_count bigint, rage_click_count bigint, sessions bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(t.route,'(none)'),
    t.event_name,
    COUNT(*)::bigint,
    SUM(CASE WHEN t.event_name='rage_click_detected' THEN 1 ELSE 0 END)::bigint,
    COUNT(DISTINCT t.session_id)::bigint
  FROM telemetry_events t
  WHERE t."timestamp">=_since
  GROUP BY 1,2
  ORDER BY 3 DESC
  LIMIT 100;
END $$;

-- 7) Baseline de 7 dias
CREATE OR REPLACE FUNCTION public.admin_telemetry_baseline()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days int; v_events bigint; v_users bigint; v_sessions bigint; v_first_q bigint; v_answers bigint;
  v_d1 numeric; v_d7 numeric; v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  SELECT COALESCE(EXTRACT(DAY FROM (now() - MIN("timestamp")))::int, 0)
    INTO v_days FROM telemetry_events;
  SELECT COUNT(*), COUNT(DISTINCT user_id), COUNT(DISTINCT session_id),
         COUNT(*) FILTER (WHERE event_name='first_question_loaded'),
         COUNT(*) FILTER (WHERE event_name='first_answer_submitted')
    INTO v_events, v_users, v_sessions, v_first_q, v_answers
  FROM telemetry_events;

  -- Retenção D1/D7 simples
  WITH first_day AS (
    SELECT user_id, MIN(date_trunc('day',"timestamp")) AS d0 FROM telemetry_events GROUP BY user_id
  ),
  d1 AS (
    SELECT COUNT(DISTINCT t.user_id) AS c
    FROM telemetry_events t JOIN first_day f USING(user_id)
    WHERE date_trunc('day', t."timestamp") = f.d0 + interval '1 day'
  ),
  d7 AS (
    SELECT COUNT(DISTINCT t.user_id) AS c
    FROM telemetry_events t JOIN first_day f USING(user_id)
    WHERE date_trunc('day', t."timestamp") = f.d0 + interval '7 day'
  ),
  total AS (SELECT COUNT(*) AS c FROM first_day)
  SELECT
    CASE WHEN (SELECT c FROM total)>0 THEN ROUND(((SELECT c FROM d1)::numeric/(SELECT c FROM total))*100,1) ELSE 0 END,
    CASE WHEN (SELECT c FROM total)>0 THEN ROUND(((SELECT c FROM d7)::numeric/(SELECT c FROM total))*100,1) ELSE 0 END
  INTO v_d1, v_d7;

  v_status := CASE
    WHEN v_days >= 7 AND v_sessions >= 100 AND v_users >= 10 AND v_first_q >= 30 THEN 'PRONTO'
    WHEN v_events > 50 THEN 'EM COLETA'
    ELSE 'INSUFICIENTE'
  END;

  RETURN jsonb_build_object(
    'days_collected', v_days,
    'total_events', v_events,
    'unique_users', v_users,
    'sessions_started', v_sessions,
    'first_questions', v_first_q,
    'answers_submitted', v_answers,
    'retention_d1', v_d1,
    'retention_d7', v_d7,
    'status', v_status,
    'criteria', jsonb_build_object(
      'days_required', 7,
      'sessions_required', 100,
      'users_required', 10,
      'first_questions_required', 30
    )
  );
END $$;

-- 8) Alertas
CREATE OR REPLACE FUNCTION public.admin_telemetry_alerts(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
  alerts jsonb := '[]'::jsonb;
  v_dash bigint; v_first bigint; v_rage bigint; v_idle bigint; v_repeat bigint;
  v_completed bigint; v_returned_next bigint;
  pct_first numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE event_name='dashboard_opened'),
    COUNT(*) FILTER (WHERE event_name='first_question_loaded'),
    COUNT(*) FILTER (WHERE event_name='rage_click_detected'),
    COUNT(*) FILTER (WHERE event_name='idle_dashboard'),
    COUNT(*) FILTER (WHERE event_name='repeated_navigation'),
    COUNT(*) FILTER (WHERE event_name='study_session_completed'),
    COUNT(*) FILTER (WHERE event_name='returned_next_day')
  INTO v_dash, v_first, v_rage, v_idle, v_repeat, v_completed, v_returned_next
  FROM telemetry_events WHERE "timestamp">=_since;

  pct_first := CASE WHEN v_dash>0 THEN ROUND((v_first::numeric/v_dash)*100,1) ELSE 0 END;

  IF v_dash >= 10 AND pct_first < 30 THEN
    alerts := alerts || jsonb_build_object(
      'severity','high','title','Conversão Hoje → Questão baixa',
      'metric','first_question_rate','current_value', pct_first, 'threshold', 30,
      'recommendation','Reduza atrito do CTA principal e revise tempo de carregamento da Sessão de Estudo.'
    );
  END IF;

  IF v_rage > 5 THEN
    alerts := alerts || jsonb_build_object(
      'severity','medium','title','Rage clicks elevados',
      'metric','rage_click_detected','current_value', v_rage,'threshold', 5,
      'recommendation','Investigar componentes interativos lentos ou que não respondem ao primeiro clique.'
    );
  END IF;

  IF v_idle > 20 THEN
    alerts := alerts || jsonb_build_object(
      'severity','low','title','Sessões ociosas no dashboard',
      'metric','idle_dashboard','current_value', v_idle,'threshold', 20,
      'recommendation','Avaliar clareza do CTA principal e prompt cognitivo de "próximo passo".'
    );
  END IF;

  IF v_repeat > 10 THEN
    alerts := alerts || jsonb_build_object(
      'severity','medium','title','Navegação repetida (looping)',
      'metric','repeated_navigation','current_value', v_repeat,'threshold', 10,
      'recommendation','Aluno está procurando algo que não encontra. Revise hierarquia do menu.'
    );
  END IF;

  IF v_dash >= 10 AND v_completed = 0 THEN
    alerts := alerts || jsonb_build_object(
      'severity','critical','title','Nenhuma sessão concluída',
      'metric','study_session_completed','current_value', 0,'threshold', 1,
      'recommendation','Verificar se o fluxo de finalização de sessão está funcionando corretamente.'
    );
  END IF;

  IF v_dash >= 20 AND v_returned_next = 0 THEN
    alerts := alerts || jsonb_build_object(
      'severity','high','title','Retenção D1 ausente',
      'metric','returned_next_day','current_value', 0,'threshold', 1,
      'recommendation','Sem retorno no dia seguinte. Reforçar gatilhos de retorno (push/email).'
    );
  END IF;

  RETURN alerts;
END $$;

-- 9) Export bruto admin (CSV-friendly)
CREATE OR REPLACE FUNCTION public.admin_telemetry_export(_days integer DEFAULT 7, _limit integer DEFAULT 5000)
RETURNS TABLE("timestamp" timestamptz, user_id uuid, session_id uuid, event_name text, route text, device_type text, screen_size text, properties jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - make_interval(days => GREATEST(_days,1));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
  SELECT t."timestamp", t.user_id, t.session_id, t.event_name, t.route, t.device_type, t.screen_size, t.properties
  FROM telemetry_events t
  WHERE t."timestamp">=_since
  ORDER BY t."timestamp" DESC
  LIMIT GREATEST(LEAST(_limit, 50000), 1);
END $$;