-- CME GPU Workers: Distributed cluster tracking
CREATE TABLE public.cme_gpu_workers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    worker_name TEXT NOT NULL,
    gpu_model TEXT,
    vram_total_mb INTEGER,
    vram_used_mb INTEGER DEFAULT 0,
    current_load FLOAT DEFAULT 0,
    active_jobs INTEGER DEFAULT 0,
    temperature_c FLOAT,
    render_capacity INTEGER DEFAULT 1, -- number of parallel renders allowed
    status TEXT NOT NULL DEFAULT 'offline', -- online, offline, busy, maintenance
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CME Render Jobs: The orchestration core
CREATE TABLE public.cme_render_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    render_type TEXT NOT NULL, -- full_lecture, quick_review, microlearning, feynman, recovery
    render_mode TEXT DEFAULT 'standard', -- quality vs speed
    status TEXT NOT NULL DEFAULT 'queued', -- queued, preparing, semantic_processing, narrative_building, pacing_generation, voice_rendering, visual_composition, cinematic_rendering, transcoding, uploading, completed, failed, retrying
    priority INTEGER DEFAULT 50, -- 0-100, higher is faster
    
    -- Execution tracking
    queued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    gpu_worker_id UUID REFERENCES public.cme_gpu_workers(id),
    
    -- Artifacts
    output_url TEXT,
    thumbnail_url TEXT,
    preview_url TEXT,
    chapter_manifest JSONB, -- list of chapter start/end times and metadata
    
    -- Context & Metadata
    render_metadata JSONB DEFAULT '{}'::jsonb, -- resolution, bitrate, encoder
    adaptive_profile_snapshot JSONB, -- current student cognitive state at time of request
    render_duration_ms INTEGER,
    estimated_cost_cents INTEGER,
    
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CME Scene Graphs: The visual blueprint
CREATE TABLE public.cme_scene_graphs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    scene_graph JSONB NOT NULL, -- Logical structure of scenes
    motion_graph JSONB, -- Animation easing and timing
    overlay_graph JSONB, -- Callouts, highlights, medical diagrams
    focus_graph JSONB, -- Semantic zoom and visual attention markers
    visual_attention_map JSONB, -- Predicted eye tracking hotspots
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- CME Render Failures: Forensics & Auto-recovery
CREATE TABLE public.cme_render_failures (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    failure_type TEXT NOT NULL, -- timeout, oom, encoder_error, network_error
    render_stage TEXT NOT NULL,
    stack_trace TEXT,
    gpu_worker_id UUID,
    recovery_attempt INTEGER DEFAULT 0,
    auto_fix_applied BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_gpu_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_scene_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_failures ENABLE ROW LEVEL SECURITY;

-- Policies for Workers (Service role access or explicit worker auth)
CREATE POLICY "Workers can read and update their own status" ON public.cme_gpu_workers FOR ALL USING (true);
CREATE POLICY "Workers can manage assigned render jobs" ON public.cme_render_jobs FOR ALL USING (true);
CREATE POLICY "Workers can read scene graphs" ON public.cme_scene_graphs FOR SELECT USING (true);
CREATE POLICY "Workers can report failures" ON public.cme_render_failures FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_cme_render_jobs_updated_at
BEFORE UPDATE ON public.cme_render_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to claim a job (Atomic lock)
CREATE OR REPLACE FUNCTION public.claim_cme_render_job(worker_id UUID)
RETURNS UUID AS $$
DECLARE
    target_job_id UUID;
BEGIN
    UPDATE public.cme_render_jobs
    SET status = 'preparing',
        gpu_worker_id = worker_id,
        started_at = now(),
        updated_at = now()
    WHERE id = (
        SELECT id FROM public.cme_render_jobs
        WHERE status = 'queued'
        ORDER BY priority DESC, queued_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING id INTO target_job_id;
    
    RETURN target_job_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;