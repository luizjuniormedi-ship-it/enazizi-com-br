
-- Tabela de Sessões Pedagógicas Persistentes
CREATE TABLE public.pedagogical_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    conversation_id UUID UNIQUE, -- Link com a conversa do chat_messages
    topic TEXT NOT NULL,
    specialty TEXT,
    
    -- Estado do Progresso
    current_block INTEGER DEFAULT 1,
    completed_blocks INTEGER[] DEFAULT '{}',
    total_blocks INTEGER DEFAULT 15,
    
    -- Estado Cognitivo e Comportamental
    tutor_mode TEXT DEFAULT 'normal' CHECK (tutor_mode IN ('recovery', 'normal', 'mastery')),
    cognitive_state TEXT DEFAULT 'stable' CHECK (cognitive_state IN ('confused', 'stable', 'mastery', 'fatigued')),
    comprehension_score INTEGER DEFAULT 50, -- 0-100
    difficulty_level INTEGER DEFAULT 1, -- 1-5
    
    -- Metadados Longitudinais
    metadata JSONB DEFAULT '{
        "interaction_count": 0,
        "recovery_activations": 0,
        "mastery_activations": 0,
        "average_response_time_ms": 0,
        "preferred_explanation_style": "standard"
    }'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pedagogical_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Users can manage their own pedagogical sessions"
ON public.pedagogical_sessions
FOR ALL
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_pedagogical_sessions_updated_at
BEFORE UPDATE ON public.pedagogical_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_ped_sessions_user ON public.pedagogical_sessions(user_id);
CREATE INDEX idx_ped_sessions_conv ON public.pedagogical_sessions(conversation_id);
