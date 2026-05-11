ALTER TABLE public.telemetry_events ALTER COLUMN session_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.complete_study_action_atomic(
    p_user_id UUID,
    p_task_id UUID,
    p_tema TEXT,
    p_card_id UUID,
    p_rating INTEGER,
    p_scheduled_days DOUBLE PRECISION DEFAULT NULL,
    p_elapsed_days DOUBLE PRECISION DEFAULT NULL,
    p_event_properties JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_session_id UUID;
BEGIN
    -- Extract session_id if provided
    v_session_id := (p_event_properties->>'session_id')::UUID;

    -- Update Daily Plan Tasks
    IF p_task_id IS NOT NULL THEN
        UPDATE public.daily_plan_tasks 
        SET status = 'completed', completed_at = v_now, updated_at = v_now
        WHERE id = p_task_id AND user_id = p_user_id;
    END IF;

    -- Upsert Study History
    INSERT INTO public.temas_estudados (user_id, tema, data_estudo, especialidade, updated_at)
    VALUES (p_user_id, p_tema, v_now::date, 'Geral', v_now)
    ON CONFLICT (user_id, tema, data_estudo) 
    DO UPDATE SET updated_at = v_now;

    -- Insert FSRS Review Log
    IF p_card_id IS NOT NULL THEN
        INSERT INTO public.fsrs_review_log (user_id, card_id, rating, scheduled_days, elapsed_days, reviewed_at)
        VALUES (p_user_id, p_card_id, p_rating, p_scheduled_days, p_elapsed_days, v_now);
    END IF;

    -- Log Telemetry
    INSERT INTO public.telemetry_events (user_id, session_id, event_name, properties, timestamp)
    VALUES (p_user_id, v_session_id, 'study_action_completed', p_event_properties || jsonb_build_object('tema', p_tema), v_now);

    RETURN jsonb_build_object('status', 'success', 'timestamp', v_now);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
