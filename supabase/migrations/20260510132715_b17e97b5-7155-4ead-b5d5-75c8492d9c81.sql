-- Create enums for lesson status and types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lesson_generation_status') THEN
        CREATE TYPE public.lesson_generation_status AS ENUM ('queued', 'processing', 'completed', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lesson_type_enum') THEN
        CREATE TYPE public.lesson_type_enum AS ENUM ('resumo', 'aula_completa', 'revisao', 'questoes', 'mapa_mental');
    END IF;
END $$;

-- Create tutor_lessons table
CREATE TABLE IF NOT EXISTS public.tutor_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID, -- References tutor_sessions.id
    conversation_id UUID, -- References chat_conversations.id
    title TEXT NOT NULL,
    lesson_type public.lesson_type_enum NOT NULL DEFAULT 'aula_completa',
    content JSONB NOT NULL,
    source_message_count INTEGER NOT NULL DEFAULT 0,
    cme_pipeline_id UUID,
    cme_status TEXT DEFAULT 'not_requested',
    generation_status public.lesson_generation_status NOT NULL DEFAULT 'completed',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_lessons ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own lessons" 
ON public.tutor_lessons 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lessons" 
ON public.tutor_lessons 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lessons" 
ON public.tutor_lessons 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lessons" 
ON public.tutor_lessons 
FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tutor_lessons_updated_at
BEFORE UPDATE ON public.tutor_lessons
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tutor_lessons_user_id ON public.tutor_lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_tutor_lessons_session_id ON public.tutor_lessons(session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_lessons_conversation_id ON public.tutor_lessons(conversation_id);
