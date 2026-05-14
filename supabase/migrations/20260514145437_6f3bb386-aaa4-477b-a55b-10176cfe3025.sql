CREATE TABLE IF NOT EXISTS public.enaflix_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  specialty TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'video', -- video, resumo, aula, artigo, podcast
  thumbnail_url TEXT,
  video_url TEXT, -- URL do vídeo (YouTube embed, Vimeo, ou arquivo direto)
  duration_minutes INTEGER,
  difficulty TEXT DEFAULT 'intermediario', -- facil, intermediario, dificil
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  order_index INTEGER DEFAULT 0
);

-- Tabela de progresso do aluno
CREATE TABLE IF NOT EXISTS public.enaflix_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.enaflix_content(id) ON DELETE CASCADE,
  watched BOOLEAN DEFAULT false,
  watched_at TIMESTAMPTZ,
  progress_percent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable Row Level Security
ALTER TABLE public.enaflix_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enaflix_progress ENABLE ROW LEVEL SECURITY;

-- Policies for enaflix_content
CREATE POLICY "Users can read published content" ON public.enaflix_content
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage content" ON public.enaflix_content
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'professor'))
  );

-- Policies for enaflix_progress
CREATE POLICY "Users manage own progress" ON public.enaflix_progress
  FOR ALL USING (user_id = auth.uid());