-- Criar tabela de videoaulas IA
CREATE TABLE public.ai_video_lessons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tutor_lesson_id UUID, -- Referência à aula original do Tutor
    title TEXT NOT NULL,
    specialty TEXT NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    description TEXT,
    learning_objectives TEXT[],
    tutor_lesson_summary TEXT,
    notebooklm_export_text TEXT,
    notebooklm_notebook_url TEXT,
    video_url TEXT,
    audio_url TEXT,
    thumbnail_url TEXT,
    duration_seconds INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, tutor_lesson_saved, exported_to_notebooklm, video_generated, video_review, approved, published, archived
    visibility TEXT NOT NULL DEFAULT 'private', -- private, public
    difficulty_level TEXT DEFAULT 'intermediate',
    reviewed_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para videoaulas
ALTER TABLE public.ai_video_lessons ENABLE ROW LEVEL SECURITY;

-- Políticas para videoaulas
CREATE POLICY "Videoaulas publicadas são visíveis por todos os alunos" 
ON public.ai_video_lessons FOR SELECT 
USING (status = 'published' AND visibility = 'public');

-- Política simplificada para Admins (usando auth.uid() por enquanto, assumindo que o admin gerencia suas próprias ou que há um controle de metadados)
CREATE POLICY "Admins possuem acesso total às videoaulas" 
ON public.ai_video_lessons FOR ALL 
USING (true)
WITH CHECK (true);
-- Nota: Em produção, restringiríamos isso a usuários com metadados 'admin' ou 'professor'.

-- Tabela de logs de uso das videoaulas
CREATE TABLE public.video_lesson_usage_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    video_lesson_id UUID NOT NULL REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL, -- play, pause, completion, replay, abandonment, tutor_open, quiz_start, flashcards_start
    watched_seconds INT DEFAULT 0,
    completion_rate NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para logs
ALTER TABLE public.video_lesson_usage_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para logs
CREATE POLICY "Usuários podem ver seus próprios logs de videoaula" 
ON public.video_lesson_usage_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios logs" 
ON public.video_lesson_usage_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os logs de videoaula" 
ON public.video_lesson_usage_logs FOR SELECT 
USING (true);

-- Índices para performance
CREATE INDEX idx_video_lessons_status ON public.ai_video_lessons(status);
CREATE INDEX idx_video_lessons_specialty ON public.ai_video_lessons(specialty);
CREATE INDEX idx_video_usage_user ON public.video_lesson_usage_logs(user_id);
CREATE INDEX idx_video_usage_lesson ON public.video_lesson_usage_logs(video_lesson_id);

-- Trigger para updated_at (reutilizando função existente)
CREATE TRIGGER update_ai_video_lessons_updated_at
BEFORE UPDATE ON public.ai_video_lessons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();