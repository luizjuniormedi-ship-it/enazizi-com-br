-- 1. Tabela Central de Eventos Pedagógicos
CREATE TABLE IF NOT EXISTS public.pedagogical_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID,
    event_type TEXT NOT NULL,
    module TEXT NOT NULL,
    source TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    entity_type TEXT,
    entity_id UUID,
    study_context JSONB DEFAULT '{}'::jsonb,
    cognitive_context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    consumed_by JSONB DEFAULT '[]'::jsonb,
    idempotency_key TEXT,
    retry_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Índices Estratégicos
CREATE INDEX IF NOT EXISTS idx_ped_events_user_created ON public.pedagogical_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ped_events_type ON public.pedagogical_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ped_events_module ON public.pedagogical_events(module);
CREATE INDEX IF NOT EXISTS idx_ped_events_severity ON public.pedagogical_events(severity);
CREATE INDEX IF NOT EXISTS idx_ped_events_entity ON public.pedagogical_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ped_events_status ON public.pedagogical_events(status);
CREATE INDEX IF NOT EXISTS idx_ped_events_idempotency ON public.pedagogical_events(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ped_events_topic ON public.pedagogical_events USING GIN ((study_context->'topic'));
CREATE INDEX IF NOT EXISTS idx_ped_events_fsrs_risk ON public.pedagogical_events USING GIN ((cognitive_context->'fsrs_risk'));

-- 3. Row Level Security (RLS)
ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events"
ON public.pedagogical_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events"
ON public.pedagogical_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
ON public.pedagogical_events FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Função para Registrar Consumo (Idempotência)
CREATE OR REPLACE FUNCTION public.mark_pedagogical_event_consumed(
    event_id UUID,
    consumer_name TEXT,
    success BOOLEAN,
    result_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    UPDATE public.pedagogical_events
    SET 
        consumed_by = consumed_by || jsonb_build_object(
            'consumer', consumer_name,
            'timestamp', now(),
            'success', success,
            'metadata', result_metadata
        ),
        status = CASE WHEN success THEN 'consumed' ELSE 'failed' END,
        updated_at = now()
    WHERE id = event_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Função para Atualizar Timestamps (se necessário)
ALTER TABLE public.pedagogical_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE TRIGGER set_pedagogical_events_updated_at
BEFORE UPDATE ON public.pedagogical_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
