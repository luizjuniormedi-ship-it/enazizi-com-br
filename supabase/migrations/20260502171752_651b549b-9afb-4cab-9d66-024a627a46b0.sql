-- 1. Expandir tutor_lesson_memory
ALTER TABLE public.tutor_lesson_memory 
ADD COLUMN IF NOT EXISTS generated_from_real_usage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pedagogical_interest_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS study_sessions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tutor_messages_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS related_error_bank_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS related_fsrs_reviews INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS related_questions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS generation_reason TEXT,
ADD COLUMN IF NOT EXISTS user_learning_pattern JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ai_generation_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cinematic_prompt JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS notebooklm_export TEXT,
ADD COLUMN IF NOT EXISTS gemini_export TEXT,
ADD COLUMN IF NOT EXISTS google_vids_export TEXT,
ADD COLUMN IF NOT EXISTS admin_review_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS production_pipeline_status TEXT DEFAULT 'pending_detection';

-- 2. Criar tutor_study_tracking
CREATE TABLE IF NOT EXISTS public.tutor_study_tracking (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    subject TEXT,
    subtopic TEXT,
    tutor_session_id TEXT,
    interaction_count INTEGER DEFAULT 1,
    total_study_time INTEGER DEFAULT 0, -- em segundos
    flashcards_generated INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    fsrs_reviews INTEGER DEFAULT 0,
    related_errors INTEGER DEFAULT 0,
    interest_score NUMERIC DEFAULT 0,
    last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index para performance de busca por tema/aluno
CREATE INDEX IF NOT EXISTS idx_study_tracking_user_topic ON public.tutor_study_tracking(user_id, topic);

-- 3. Habilitar RLS e criar políticas para tutor_study_tracking
ALTER TABLE public.tutor_study_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own study tracking"
ON public.tutor_study_tracking FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all study tracking"
ON public.tutor_study_tracking FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'ceo')
));

-- 4. Triggers para updated_at
CREATE TRIGGER update_tutor_study_tracking_updated_at
BEFORE UPDATE ON public.tutor_study_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Adicionar tipos de eventos (comentário documental, o app lida com os valores)
-- Eventos esperados: lesson_auto_detected, lesson_generation_started, lesson_generation_completed, 
-- lesson_sent_to_admin, lesson_video_uploaded, lesson_published_to_student
