-- Enums para o motor de recuperação autônoma
DO $$ BEGIN
    CREATE TYPE public.pipeline_job_type AS ENUM ('ingestion', 'bulk_generation', 'ecg_extraction', 'embedding_sync', 'ocr_process');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.pipeline_job_status AS ENUM ('pending', 'running', 'failed', 'completed', 'degraded', 'retrying');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de Jobs do Pipeline (Autonomous Recovery Engine)
CREATE TABLE IF NOT EXISTS public.pipeline_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type public.pipeline_job_type NOT NULL,
    status public.pipeline_job_status NOT NULL DEFAULT 'pending',
    stage TEXT DEFAULT 'initial',
    retries INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 5,
    recovery_mode BOOLEAN DEFAULT true,
    fallback_used BOOLEAN DEFAULT false,
    last_error TEXT,
    progress JSONB DEFAULT '{}'::jsonb,
    payload JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS
ALTER TABLE public.pipeline_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Users can view their own jobs" 
ON public.pipeline_jobs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all jobs" 
ON public.pipeline_jobs FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage jobs" 
ON public.pipeline_jobs FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_pipeline_jobs_updated_at
BEFORE UPDATE ON public.pipeline_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_status ON public.pipeline_jobs(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_type ON public.pipeline_jobs(type);
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_user_id ON public.pipeline_jobs(user_id);
