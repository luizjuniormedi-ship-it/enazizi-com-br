-- 1. Enum para as etapas da aula estruturada
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tutor_lesson_stage') THEN
        CREATE TYPE public.tutor_lesson_stage AS ENUM (
            'mission',
            'layman',
            'technical',
            'pathophysiology',
            'clinical_reasoning',
            'practical_integration',
            'exam_tricks',
            'active_recall',
            'mini_test',
            'summary',
            'next_step'
        );
    END IF;
END $$;

-- 2. Atualizar tutor_sessions para rastrear o estágio e progresso
ALTER TABLE public.tutor_sessions 
ADD COLUMN IF NOT EXISTS current_stage public.tutor_lesson_stage DEFAULT 'mission',
ADD COLUMN IF NOT EXISTS cognitive_progress INTEGER DEFAULT 0, -- 0 a 100
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Tabela para histórico de estágios (Auditoria Pedagógica)
CREATE TABLE IF NOT EXISTS public.tutor_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stage public.tutor_lesson_stage NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    outcome_metadata JSONB DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE public.tutor_stage_history ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own stage history" 
ON public.tutor_stage_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stage history" 
ON public.tutor_stage_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 4. Índice para performance
CREATE INDEX IF NOT EXISTS idx_tutor_stage_history_session ON public.tutor_stage_history(session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_stage ON public.tutor_sessions(user_id, current_stage);
