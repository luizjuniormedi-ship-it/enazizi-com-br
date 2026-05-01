-- Create cme_tutor_origins table
CREATE TABLE IF NOT EXISTS public.cme_tutor_origins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tutor_session_id UUID NOT NULL,
    tutor_message_id UUID NOT NULL,
    lesson_id UUID,
    cme_video_project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for origins
ALTER TABLE public.cme_tutor_origins ENABLE ROW LEVEL SECURITY;

-- Fallback policy since lessons table doesn't have user_id directly
CREATE POLICY "Public read for tutor origins"
    ON public.cme_tutor_origins FOR SELECT
    USING (true);

-- Create cme_pipeline_events table for telemetry
CREATE TABLE IF NOT EXISTS public.cme_pipeline_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    stage TEXT NOT NULL, -- planning, scripting, rendering, etc.
    status TEXT NOT NULL, -- queued, in_progress, completed, failed
    progress INTEGER DEFAULT 0,
    message TEXT,
    worker_id TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for pipeline events
ALTER TABLE public.cme_pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for pipeline events"
    ON public.cme_pipeline_events FOR SELECT
    USING (true);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_cme_tutor_origins_session ON public.cme_tutor_origins(tutor_session_id);
CREATE INDEX IF NOT EXISTS idx_cme_pipeline_events_project ON public.cme_pipeline_events(project_id);
