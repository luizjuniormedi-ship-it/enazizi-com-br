
-- Recriar tabela de auditoria de playback
CREATE TABLE IF NOT EXISTS public.cme_playback_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    selected_url TEXT,
    media_status TEXT,
    player_state TEXT,
    error_message TEXT,
    load_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cme_playback_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own playback logs' AND tablename = 'cme_playback_audit_logs') THEN
    CREATE POLICY "Users can insert their own playback logs" 
    ON public.cme_playback_audit_logs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all playback logs' AND tablename = 'cme_playback_audit_logs') THEN
    CREATE POLICY "Admins can view all playback logs" 
    ON public.cme_playback_audit_logs FOR SELECT 
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;
