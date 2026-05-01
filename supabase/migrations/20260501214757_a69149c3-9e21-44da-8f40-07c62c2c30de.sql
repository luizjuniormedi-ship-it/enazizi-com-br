-- Create eligibility logs for gating logic
CREATE TABLE IF NOT EXISTS public.cme_generation_eligibility_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_message_id UUID NOT NULL,
    eligible BOOLEAN NOT NULL,
    rejection_reason TEXT,
    structure_score FLOAT,
    cognitive_density FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add lineage and tracking columns to cme_video_projects
ALTER TABLE public.cme_video_projects 
ADD COLUMN IF NOT EXISTS health_score FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS narrative_coherence_score FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS fatigue_risk_score FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS overload_score FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS quality_ai_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS lineage_path TEXT;

-- Create table for granular render job tracking
CREATE TABLE IF NOT EXISTS public.cme_render_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
    stage TEXT DEFAULT 'planning', -- planning, scene_graph, voice, gpu_render, hls, cdn
    retry_count INTEGER DEFAULT 0,
    worker_id TEXT,
    error_message TEXT,
    stage_latency JSONB DEFAULT '{}'::jsonb,
    quality_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_generation_eligibility_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_jobs ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they exist with correct rules
DROP POLICY IF EXISTS "Allow all access to cme_generation_eligibility_logs for authenticated users" ON public.cme_generation_eligibility_logs;
CREATE POLICY "Allow all access to cme_generation_eligibility_logs for authenticated users" 
ON public.cme_generation_eligibility_logs FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all access to cme_render_jobs for authenticated users" ON public.cme_render_jobs;
CREATE POLICY "Allow all access to cme_render_jobs for authenticated users" 
ON public.cme_render_jobs FOR ALL USING (auth.role() = 'authenticated');

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_cme_render_jobs_updated_at ON public.cme_render_jobs;
CREATE TRIGGER update_cme_render_jobs_updated_at
BEFORE UPDATE ON public.cme_render_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
