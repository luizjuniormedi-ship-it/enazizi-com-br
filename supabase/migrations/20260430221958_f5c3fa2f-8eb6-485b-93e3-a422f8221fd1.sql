-- Tabela de Logs de Uso Multimídia (Analytics)
CREATE TABLE IF NOT EXISTS public.notebooklm_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'audio_play', 'audio_complete', 'guide_open', 'audio_pause', 'audio_resume'
    media_type TEXT, -- 'audio', 'guide', 'video'
    playback_time INTEGER DEFAULT 0, -- em segundos
    completion_rate NUMERIC(5,2) DEFAULT 0, -- 0 a 100
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.notebooklm_usage_logs ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can insert their own usage logs" 
ON public.notebooklm_usage_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins/Professors can view all usage logs" 
ON public.notebooklm_usage_logs 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Índices para Analytics
CREATE INDEX IF NOT EXISTS idx_notebooklm_usage_action ON public.notebooklm_usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_notebooklm_usage_content ON public.notebooklm_usage_logs(content_id);
CREATE INDEX IF NOT EXISTS idx_notebooklm_usage_user ON public.notebooklm_usage_logs(user_id);

-- Extensão da tabela de notebooks para metadados de progresso (opcional, logs já cobrem)
ALTER TABLE public.notebooklm_notebooks 
ADD COLUMN IF NOT EXISTS total_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_completion_rate NUMERIC(5,2) DEFAULT 0;
