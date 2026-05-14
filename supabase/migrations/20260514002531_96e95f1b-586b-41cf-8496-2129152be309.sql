CREATE OR REPLACE FUNCTION public.get_unified_dashboard_data(p_user_id uuid, p_reset_at timestamp with time zone, p_today_iso timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
    v_flashcards_count BIGINT;
    v_uploads_count BIGINT;
    v_daily_plan JSONB;
    v_metrics JSONB;
    v_profile JSONB;
    v_accuracy INT;
    v_pending_reviews BIGINT;
    v_streak INT;
    v_avg_retention FLOAT;
    v_total_answered BIGINT;
    v_total_correct BIGINT;
    v_upcoming_reviews JSONB;
BEGIN
    -- Basic counts
    SELECT count(*) INTO v_flashcards_count FROM flashcards WHERE user_id = p_user_id;
    SELECT count(*) INTO v_uploads_count FROM uploads WHERE user_id = p_user_id;

    -- Accuracy calculation
    SELECT count(*), count(*) FILTER (WHERE correct = true) 
    INTO v_total_answered, v_total_correct 
    FROM practice_attempts WHERE user_id = p_user_id;
    
    IF v_total_answered > 0 THEN
        v_accuracy := round((v_total_correct::float / v_total_answered) * 100);
    ELSE
        v_accuracy := 0;
    END IF;

    -- Pending reviews
    SELECT count(*) INTO v_pending_reviews 
    FROM revisoes 
    WHERE user_id = p_user_id AND status = 'pendente' AND data_revisao <= p_today_iso::date;

    -- Upcoming reviews
    SELECT jsonb_agg(jsonb_build_object('topic', t.tema, 'next_review', r.data_revisao))
    INTO v_upcoming_reviews
    FROM (
        SELECT tema_id, data_revisao 
        FROM revisoes 
        WHERE user_id = p_user_id AND status = 'pendente' AND data_revisao > p_today_iso::date
        ORDER BY data_revisao ASC 
        LIMIT 5
    ) r
    JOIN temas_estudados t ON r.tema_id = t.id;

    -- Gamification
    SELECT current_streak INTO v_streak FROM user_gamification WHERE user_id = p_user_id;
    v_streak := COALESCE(v_streak, 0);

    -- Retention (FSRS)
    SELECT avg(retrievability) INTO v_avg_retention FROM fsrs_cards WHERE user_id = p_user_id;
    v_avg_retention := COALESCE(v_avg_retention, 0.5);

    -- Optimized daily plan
    SELECT jsonb_build_object(
        'plan', (SELECT row_to_json(dp) FROM daily_plans dp WHERE user_id = p_user_id AND plan_date >= (now() - interval '7 days')::date ORDER BY plan_date DESC LIMIT 1),
        'tasks', (SELECT jsonb_agg(row_to_json(dt)) FROM daily_plan_tasks dt WHERE user_id = p_user_id AND (created_at > p_reset_at OR created_at >= p_today_iso))
    ) INTO v_daily_plan;

    -- Metrics Object
    v_metrics := jsonb_build_object(
        'accuracy', v_accuracy,
        'pending_reviews', v_pending_reviews,
        'streak', v_streak,
        'avg_retention', v_avg_retention,
        'total_answered', v_total_answered
    );

    -- Profile
    SELECT row_to_json(p) INTO v_profile FROM profiles p WHERE user_id = p_user_id;

    -- Final Consolidation
    v_result := jsonb_build_object(
        'flashcards_count', v_flashcards_count,
        'uploads_count', v_uploads_count,
        'daily_plan', v_daily_plan,
        'metrics', v_metrics,
        'profile', v_profile,
        'upcoming_reviews', v_upcoming_reviews,
        'server_time', now()
    );

    RETURN v_result;
END;
$function$;