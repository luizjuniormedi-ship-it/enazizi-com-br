-- 0. Profiles Expansion
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'student';
    END IF;
END $$;

-- 1. GPU Orchestration Center
CREATE TABLE IF NOT EXISTS public.cme_gpu_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    region TEXT NOT NULL,
    provider TEXT NOT NULL,
    max_workers INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.cme_worker_nodes 
ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES public.cme_gpu_clusters(id),
ADD COLUMN IF NOT EXISTS vram_total_mb INTEGER,
ADD COLUMN IF NOT EXISTS vram_used_mb INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS temperature_c INTEGER,
ADD COLUMN IF NOT EXISTS gpu_utilization_pct INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_draining BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cme_worker_draining_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES public.cme_worker_nodes(id) NOT NULL,
    reason TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    active_jobs_at_start INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Distributed Render Queues
CREATE TABLE IF NOT EXISTS public.cme_queue_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    weight INTEGER NOT NULL DEFAULT 1,
    sla_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_render_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priority_id UUID REFERENCES public.cme_queue_priorities(id),
    name TEXT NOT NULL,
    description TEXT,
    max_concurrency INTEGER DEFAULT 5,
    is_paused BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.cme_render_jobs 
ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES public.cme_render_queues(id),
ADD COLUMN IF NOT EXISTS priority_score FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS worker_selection_score JSONB,
ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- 3. Multi-Stage Pipeline
CREATE TABLE IF NOT EXISTS public.cme_pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL,
    timeout_seconds INTEGER DEFAULT 300,
    retry_policy_id UUID REFERENCES public.cme_retry_policies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_stage_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID REFERENCES public.cme_render_jobs(id) NOT NULL,
    stage_id UUID REFERENCES public.cme_pipeline_stages(id) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    worker_id UUID REFERENCES public.cme_worker_nodes(id),
    output_data JSONB,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_stage_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_execution_id UUID REFERENCES public.cme_stage_executions(id) NOT NULL,
    error_code TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    is_retryable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Knowledge Lineage 2.0
CREATE TABLE IF NOT EXISTS public.cme_lineage_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_lineage_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID REFERENCES public.cme_lineage_nodes(id) NOT NULL,
    target_node_id UUID REFERENCES public.cme_lineage_nodes(id) NOT NULL,
    relationship_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_lineage_transformations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edge_id UUID REFERENCES public.cme_lineage_edges(id) NOT NULL,
    transformation_type TEXT NOT NULL,
    input_hash TEXT,
    output_hash TEXT,
    parameters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Playback & Observability
CREATE TABLE IF NOT EXISTS public.cme_playback_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    render_job_id UUID REFERENCES public.cme_render_jobs(id) NOT NULL,
    last_position_seconds FLOAT DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_buffer_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playback_session_id UUID REFERENCES public.cme_playback_sessions(id) NOT NULL,
    event_type TEXT NOT NULL,
    position_seconds FLOAT NOT NULL,
    duration_ms INTEGER,
    bitrate_kbps INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Recovery Engine
CREATE TABLE IF NOT EXISTS public.cme_recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID REFERENCES public.cme_render_jobs(id) NOT NULL,
    action_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_resume_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID REFERENCES public.cme_render_jobs(id) NOT NULL,
    stage_id UUID REFERENCES public.cme_pipeline_stages(id) NOT NULL,
    checkpoint_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Cost Governance
CREATE TABLE IF NOT EXISTS public.cme_cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    allocated_budget NUMERIC(12,2),
    spent_amount NUMERIC(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_gpu_cost_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID REFERENCES public.cme_render_jobs(id) NOT NULL,
    worker_id UUID REFERENCES public.cme_worker_nodes(id) NOT NULL,
    cost_center_id UUID REFERENCES public.cme_cost_centers(id),
    vram_minutes FLOAT,
    estimated_cost NUMERIC(12,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_center_id UUID REFERENCES public.cme_cost_centers(id) NOT NULL,
    threshold_pct INTEGER NOT NULL,
    is_triggered BOOLEAN DEFAULT false,
    triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. RLS Hardening
ALTER TABLE public.cme_gpu_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_queue_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_stage_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_lineage_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_lineage_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_playback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_cost_centers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage GPU fleet" ON public.cme_gpu_clusters FOR ALL USING (auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'gpu_operator')));
CREATE POLICY "Staff can view GPU fleet" ON public.cme_gpu_clusters FOR SELECT USING (true);
CREATE POLICY "Admins can manage queues" ON public.cme_render_queues FOR ALL USING (auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'gpu_operator')));
CREATE POLICY "Users can view stages" ON public.cme_pipeline_stages FOR SELECT USING (true);
CREATE POLICY "Users can view their own playback sessions" ON public.cme_playback_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage costs" ON public.cme_cost_centers FOR ALL USING (auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'compliance_officer')));

-- Seed standard data
INSERT INTO public.cme_pipeline_stages (name, display_order, timeout_seconds) VALUES
('ingestion', 1, 60),
('semantic_planning', 2, 120),
('chaptering', 3, 120),
('pedagogical_mapping', 4, 180),
('scene_graph_generation', 5, 240),
('visual_asset_generation', 6, 600),
('narration_generation', 7, 300),
('gpu_render', 8, 1200),
('encoding', 9, 300),
('segment_packaging', 10, 300),
('enaflix_publish', 11, 60),
('analytics_registration', 12, 60)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.cme_queue_priorities (name, weight, sla_seconds) VALUES
('emergency', 100, 30),
('premium', 50, 300),
('standard', 10, 1800),
('background', 1, 86400)
ON CONFLICT (name) DO NOTHING;
