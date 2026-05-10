-- Tabela para persistência de interações e estados do mascote
CREATE TABLE IF NOT EXISTS public.mascot_interactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL, -- 'welcome', 'motivation', 'feedback', 'celebration', etc.
    emotional_state TEXT NOT NULL, -- 'happy', 'thinking', 'warning', 'fatigue', etc.
    trigger_source TEXT, -- 'tutor', 'planner', 'fsrs', 'mission'
    planner_context JSONB,
    fsrs_context JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.mascot_interactions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Users can view their own mascot interactions"
ON public.mascot_interactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mascot interactions"
ON public.mascot_interactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_mascot_interactions_user_id ON public.mascot_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mascot_interactions_created_at ON public.mascot_interactions(created_at);
