-- 1. Cleanup duplicates in temas_estudados
DELETE FROM public.temas_estudados a
USING public.temas_estudados b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.tema = b.tema
  AND a.data_estudo = b.data_estudo;

-- 2. telemetry_events table
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    session_id UUID,
    event_name TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    route TEXT,
    device_type TEXT,
    screen_size TEXT,
    timestamp TIMESTAMPTZ DEFAULT now(),
    scroll_depth INTEGER,
    time_to_first_block INTEGER
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own telemetry' AND tablename = 'telemetry_events') THEN
        CREATE POLICY "Users can insert their own telemetry" ON public.telemetry_events FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own telemetry' AND tablename = 'telemetry_events') THEN
        CREATE POLICY "Users can view their own telemetry" ON public.telemetry_events FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- 3. UNIQUE constraint on temas_estudados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'temas_estudados_user_tema_date_unique') THEN
        ALTER TABLE public.temas_estudados ADD CONSTRAINT temas_estudados_user_tema_date_unique UNIQUE (user_id, tema, data_estudo);
    END IF;
END $$;

-- 4. pg_trgm and GIN indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_error_bank_tema_trgm ON public.error_bank USING gin (tema gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_questions_bank_statement_trgm ON public.questions_bank USING gin (statement gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_medical_domain_map_specialty_trgm ON public.medical_domain_map USING gin (specialty gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_temas_estudados_tema_trgm ON public.temas_estudados USING gin (tema gin_trgm_ops);

-- 5. RLS for user_missions
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own missions' AND tablename = 'user_missions') THEN
        CREATE POLICY "Users can view own missions" ON public.user_missions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own missions' AND tablename = 'user_missions') THEN
        CREATE POLICY "Users can create own missions" ON public.user_missions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own missions' AND tablename = 'user_missions') THEN
        CREATE POLICY "Users can update own missions" ON public.user_missions FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own missions' AND tablename = 'user_missions') THEN
        CREATE POLICY "Users can delete own missions" ON public.user_missions FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 6. v_ai_telemetry view
CREATE OR REPLACE VIEW public.v_ai_telemetry AS
SELECT 
    id,
    user_id,
    event_name,
    properties,
    timestamp,
    route
FROM public.telemetry_events
WHERE event_name ILIKE 'ai_%';

-- 7. complete_study_action_atomic RPC
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
BEGIN
    -- Update Daily Plan Tasks
    IF p_task_id IS NOT NULL THEN
        UPDATE public.daily_plan_tasks 
        SET status = 'completed', completed_at = v_now, updated_at = v_now
        WHERE id = p_task_id AND user_id = p_user_id;
    END IF;

    -- Upsert Study History
    INSERT INTO public.temas_estudados (user_id, tema, data_estudo, updated_at)
    VALUES (p_user_id, p_tema, v_now::date, v_now)
    ON CONFLICT (user_id, tema, data_estudo) 
    DO UPDATE SET updated_at = v_now;

    -- Insert FSRS Review Log
    IF p_card_id IS NOT NULL THEN
        INSERT INTO public.fsrs_review_log (user_id, card_id, rating, scheduled_days, elapsed_days, reviewed_at)
        VALUES (p_user_id, p_card_id, p_rating, p_scheduled_days, p_elapsed_days, v_now);
    END IF;

    -- Log Telemetry
    INSERT INTO public.telemetry_events (user_id, event_name, properties, timestamp)
    VALUES (p_user_id, 'study_action_completed', p_event_properties || jsonb_build_object('tema', p_tema), v_now);

    RETURN jsonb_build_object('status', 'success', 'timestamp', v_now);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. approval_scores TTL cleanup
CREATE OR REPLACE FUNCTION public.cleanup_stale_approval_scores() RETURNS void AS $$
BEGIN
    DELETE FROM public.approval_scores WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;
