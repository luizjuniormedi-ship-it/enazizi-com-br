-- Tabela de Versão de Eventos Pedagógicos
CREATE TABLE IF NOT EXISTS public.pedagogical_event_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    parent_event_id UUID,
    sequence_number BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cognitive_state_before JSONB,
    cognitive_state_after JSONB,
    source_module TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    event_hash TEXT NOT NULL,
    processing_latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Tabela de Snapshots Cognitivos
CREATE TABLE IF NOT EXISTS public.cognitive_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cognitive_state JSONB NOT NULL,
    planner_state JSONB NOT NULL,
    fsrs_state JSONB NOT NULL,
    tutor_context JSONB NOT NULL,
    difficulty_state JSONB,
    fatigue_state JSONB,
    source_event_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pev_user_seq ON public.pedagogical_event_versions(user_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_pev_correlation ON public.pedagogical_event_versions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_cs_user_time ON public.cognitive_snapshots(user_id, timestamp);

-- Habilitar RLS
ALTER TABLE public.pedagogical_event_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_snapshots ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own event versions" 
ON public.pedagogical_event_versions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own event versions" 
ON public.pedagogical_event_versions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own cognitive snapshots" 
ON public.cognitive_snapshots FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cognitive snapshots" 
ON public.cognitive_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
