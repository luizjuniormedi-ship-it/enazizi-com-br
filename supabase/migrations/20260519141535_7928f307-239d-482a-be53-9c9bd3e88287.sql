-- Criar tabela para métricas de runtime do Tutor
CREATE TABLE IF NOT EXISTS public.tutor_runtime_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID,
    tutor_generation_ms INTEGER,
    audit_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    block_transition_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tutor_runtime_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own tutor metrics" ON public.tutor_runtime_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tutor metrics" ON public.tutor_runtime_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Criar tabela para transições de blocos (Prevenir Skip)
CREATE TABLE IF NOT EXISTS public.tutor_block_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID,
    previous_block INTEGER,
    next_block INTEGER,
    transition_reason TEXT,
    transition_source TEXT, -- 'auto', 'user_click'
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tutor_block_transitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own block transitions" ON public.tutor_block_transitions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own block transitions" ON public.tutor_block_transitions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Criar tabela de memória longitudinal
CREATE TABLE IF NOT EXISTS public.tutor_learning_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    misconception_tags TEXT[],
    effective_analogies TEXT[],
    mastery_milestones JSONB,
    last_retention_score NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tutor_learning_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own learning memory" ON public.tutor_learning_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert/update their own learning memory" ON public.tutor_learning_memory FOR ALL USING (auth.uid() = user_id);

-- Adicionar colunas de scores reais ao progresso se não existirem
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'enazizi_progress' AND column_name = 'retention_score') THEN
        ALTER TABLE public.enazizi_progress ADD COLUMN retention_score NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'enazizi_progress' AND column_name = 'recovery_score') THEN
        ALTER TABLE public.enazizi_progress ADD COLUMN recovery_score NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tutor_metrics_user_session ON public.tutor_runtime_metrics(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_transitions_user_session ON public.tutor_block_transitions(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_user_topic ON public.tutor_learning_memory(user_id, topic);
