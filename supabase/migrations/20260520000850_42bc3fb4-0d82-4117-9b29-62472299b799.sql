-- 1. Stream de Estado Cognitivo
CREATE TABLE IF NOT EXISTS public.cognitive_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    retention_score FLOAT DEFAULT 0,
    cognitive_load FLOAT DEFAULT 0,
    recovery_efficiency FLOAT DEFAULT 0,
    error_pressure FLOAT DEFAULT 0,
    fatigue_risk FLOAT DEFAULT 0,
    trajectory_health FLOAT DEFAULT 0,
    planner_consistency FLOAT DEFAULT 0,
    adaptive_confidence FLOAT DEFAULT 0,
    last_event_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cog_states_user ON public.cognitive_states(user_id);

-- 2. Evolução da Tabela de Eventos (Hardening)
ALTER TABLE public.pedagogical_events 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS recursion_depth INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replay_id UUID,
ADD COLUMN IF NOT EXISTS failed_reason TEXT,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 3. Detecção de Anomalias e Anti-Loop (Trigger)
CREATE OR REPLACE FUNCTION public.pedagogical_event_hardening_gate()
RETURNS TRIGGER AS $$
BEGIN
    -- Bloquear loops infinitos (Recursion Guard)
    IF NEW.recursion_depth > 10 THEN
        RAISE EXCEPTION 'Infinite loop detected in Pedagogical Event Bus for user %', NEW.user_id;
    END IF;

    -- Idempotency Check
    IF NEW.idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.pedagogical_events WHERE idempotency_key = NEW.idempotency_key AND id <> NEW.id) THEN
            RETURN NULL; -- Ignorar duplicata silenciosamente
        END IF;
    END IF;

    -- Priorização Automática conforme severidade
    NEW.priority := CASE 
        WHEN NEW.severity = 'critical' OR NEW.event_type IN ('hallucination_detected', 'runtime_error_detected') THEN 'critical'
        WHEN NEW.severity = 'error' OR NEW.event_type IN ('error_repeated', 'trajectory_risk_detected') THEN 'high'
        ELSE 'medium'
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_pedagogical_event_gate ON public.pedagogical_events;
CREATE TRIGGER tr_pedagogical_event_gate
BEFORE INSERT ON public.pedagogical_events
FOR EACH ROW EXECUTE FUNCTION public.pedagogical_event_hardening_gate();

-- 4. Função de Replay Pedagógico
CREATE OR REPLACE FUNCTION public.replay_pedagogical_events(
    p_user_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_replay_reason TEXT DEFAULT 'recalculation'
) RETURNS UUID AS $$
DECLARE
    v_replay_id UUID := gen_random_uuid();
BEGIN
    -- Inserir eventos originais como novos eventos de replay
    -- Isso permite reprocessar a lógica adaptativa sem perder o histórico original
    INSERT INTO public.pedagogical_events (
        user_id, event_type, module, source, severity, entity_type, entity_id, 
        study_context, cognitive_context, metadata, replay_id, priority, status
    )
    SELECT 
        user_id, event_type, module, source, severity, entity_type, entity_id, 
        study_context, cognitive_context, 
        metadata || jsonb_build_object('replay_original_id', id, 'replay_reason', p_replay_reason),
        v_replay_id, priority, 'pending'
    FROM public.pedagogical_events
    WHERE user_id = p_user_id 
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND replay_id IS NULL -- Evitar re-replays infinitos
    ORDER BY created_at ASC;

    RETURN v_replay_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
