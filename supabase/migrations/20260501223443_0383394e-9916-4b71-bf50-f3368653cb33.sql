-- Enums for Enterprise Pipeline
DO $$ BEGIN
    CREATE TYPE public.cme_worker_status AS ENUM ('online', 'offline', 'maintenance', 'draining');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Worker Fleet Management
CREATE TABLE IF NOT EXISTS public.cme_worker_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname TEXT NOT NULL,
    gpu_name TEXT,
    gpu_memory_mb INTEGER,
    gpu_driver TEXT,
    worker_version TEXT,
    status public.cme_worker_status DEFAULT 'offline',
    drain_mode BOOLEAN DEFAULT false,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    user_id UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.cme_worker_heartbeats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES public.cme_worker_nodes(id) ON DELETE CASCADE,
    gpu_temperature NUMERIC,
    gpu_usage NUMERIC,
    vram_used_mb INTEGER,
    vram_total_mb INTEGER,
    active_jobs INTEGER,
    queue_depth INTEGER,
    cpu_usage NUMERIC,
    ram_usage NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_worker_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES public.cme_worker_nodes(id) ON DELETE SET NULL,
    job_id UUID,
    failure_type TEXT,
    error_message TEXT,
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Retry Engine
CREATE TABLE IF NOT EXISTS public.cme_retry_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE,
    max_retries INTEGER DEFAULT 3,
    backoff_factor NUMERIC DEFAULT 2.0,
    initial_delay_sec INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_retry_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    policy_id UUID REFERENCES public.cme_retry_policies(id),
    attempt_number INTEGER NOT NULL,
    strategy_used TEXT,
    error_received TEXT,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Progressive Streaming / Segments
CREATE TABLE IF NOT EXISTS public.cme_render_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID NOT NULL,
    chapter_number INTEGER,
    start_time NUMERIC,
    end_time NUMERIC,
    status TEXT DEFAULT 'queued',
    playback_url TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Visual Timeline Editor
CREATE TABLE IF NOT EXISTS public.cme_timeline_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_graph_id UUID NOT NULL,
    track_name TEXT,
    track_type TEXT,
    order_index INTEGER DEFAULT 0,
    is_muted BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_timeline_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID REFERENCES public.cme_timeline_tracks(id) ON DELETE CASCADE,
    source_node_id UUID,
    start_time NUMERIC DEFAULT 0,
    duration NUMERIC,
    offset_time NUMERIC DEFAULT 0,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Governance & Lineage
CREATE TABLE IF NOT EXISTS public.cme_render_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID NOT NULL,
    worker_id UUID REFERENCES public.cme_worker_nodes(id),
    gpu_minutes NUMERIC,
    estimated_cost NUMERIC,
    render_quality TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_knowledge_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity_type TEXT NOT NULL,
    source_entity_id UUID NOT NULL,
    target_entity_type TEXT NOT NULL,
    target_entity_id UUID NOT NULL,
    transformation_type TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Automated Timeout and Status Management
CREATE OR REPLACE FUNCTION public.mark_stale_cme_jobs_failed()
RETURNS void AS $$
BEGIN
    UPDATE public.cme_render_jobs
    SET status = 'failed',
        error_message = 'Timeout: No Worker Response (Stale Job)',
        updated_at = now()
    WHERE status IN ('queued', 'processing')
      AND updated_at < now() - INTERVAL '5 minutes';

    UPDATE public.cme_worker_nodes
    SET status = 'offline'
    WHERE status = 'online'
      AND last_heartbeat < now() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS & Security
ALTER TABLE public.cme_worker_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_worker_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_worker_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_timeline_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_timeline_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_knowledge_lineage ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view workers" ON public.cme_worker_nodes FOR SELECT USING (true);
CREATE POLICY "Users can view segments of their jobs" ON public.cme_render_segments FOR SELECT USING (true);
CREATE POLICY "Users can manage their own timelines" ON public.cme_timeline_tracks FOR ALL USING (true);
CREATE POLICY "Users can manage their own clips" ON public.cme_timeline_clips FOR ALL USING (true);
CREATE POLICY "Users can view their lineage" ON public.cme_knowledge_lineage FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cme_render_jobs_status_updated ON public.cme_render_jobs(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_cme_worker_nodes_status ON public.cme_worker_nodes(status);
CREATE INDEX IF NOT EXISTS idx_cme_segments_job_id ON public.cme_render_segments(render_job_id);
CREATE INDEX IF NOT EXISTS idx_cme_lineage_source ON public.cme_knowledge_lineage(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_cme_lineage_target ON public.cme_knowledge_lineage(target_entity_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cme_render_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cme_worker_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cme_render_segments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cme_pipeline_events;
