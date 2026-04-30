-- Adicionar campos de memória do Tutor e destaque à tabela de videoaulas
ALTER TABLE public.ai_video_lessons 
ADD COLUMN IF NOT EXISTS tutor_session_id UUID,
ADD COLUMN IF NOT EXISTS tutor_context_snapshot_id UUID,
ADD COLUMN IF NOT EXISTS is_gold_content BOOLEAN DEFAULT false;

-- Criar tabela de quizzes das videoaulas
CREATE TABLE IF NOT EXISTS public.video_lesson_quizzes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    video_lesson_id UUID NOT NULL REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    questions JSONB NOT NULL, -- Array de objetos {question, options, correct_index, explanation}
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para quizzes
ALTER TABLE public.video_lesson_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quizzes são visíveis para todos os usuários autenticados" 
ON public.video_lesson_quizzes FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Apenas admins podem gerenciar quizzes" 
ON public.video_lesson_quizzes FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Criar tabela de tentativas de quiz
CREATE TABLE IF NOT EXISTS public.video_lesson_quiz_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_lesson_id UUID NOT NULL REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES public.video_lesson_quizzes(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    answers JSONB NOT NULL, -- Array de índices selecionados
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para tentativas
ALTER TABLE public.video_lesson_quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias tentativas" 
ON public.video_lesson_quiz_attempts FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias tentativas" 
ON public.video_lesson_quiz_attempts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_video_lessons_status ON public.ai_video_lessons(status);
CREATE INDEX IF NOT EXISTS idx_video_lessons_specialty ON public.ai_video_lessons(specialty);
CREATE INDEX IF NOT EXISTS idx_video_quiz_lesson_id ON public.video_lesson_quizzes(video_lesson_id);
CREATE INDEX IF NOT EXISTS idx_video_quiz_attempts_user_id ON public.video_lesson_quiz_attempts(user_id);

-- Garantir políticas de visibilidade para alunos na tabela principal
DROP POLICY IF EXISTS "Alunos podem ver videoaulas publicadas" ON public.ai_video_lessons;
CREATE POLICY "Alunos podem ver videoaulas publicadas" 
ON public.ai_video_lessons FOR SELECT 
USING (
    status = 'published' 
    OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor'))
);
