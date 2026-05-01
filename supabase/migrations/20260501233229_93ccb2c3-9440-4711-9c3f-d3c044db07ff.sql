-- BLOCO 1: ADAPTIVE COGNITIVE RENDERING
CREATE TABLE IF NOT EXISTS public.cme_adaptive_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    learning_style TEXT,
    pacing_preference TEXT,
    retention_score NUMERIC DEFAULT 0,
    overload_threshold NUMERIC DEFAULT 0.8,
    replay_rate NUMERIC DEFAULT 0,
    preferred_depth TEXT DEFAULT 'intermediate',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.cme_neuroanalytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    generation_id UUID REFERENCES public.cme_video_projects(id) ON DELETE SET NULL,
    fatigue_score NUMERIC DEFAULT 0,
    cognitive_load NUMERIC DEFAULT 0,
    retention_prediction NUMERIC DEFAULT 0,
    engagement_score NUMERIC DEFAULT 0,
    abandonment_risk NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BLOCO 2: PROGRESSIVE RENDER + PLAYBACK
CREATE TABLE IF NOT EXISTS public.cme_playback_segments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    title TEXT,
    start_time NUMERIC NOT NULL,
    end_time NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    video_url TEXT,
    thumbnail_url TEXT,
    transcript TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_streaming_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    device_info JSONB,
    bitrate_preference TEXT,
    last_position NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_viewing_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.cme_streaming_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    timestamp_start NUMERIC,
    timestamp_end NUMERIC,
    playback_speed NUMERIC DEFAULT 1.0,
    interaction_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BLOCO 3: BATCH CME GENERATION
CREATE TABLE IF NOT EXISTS public.cme_batch_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'queued',
    priority INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_batch_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES public.cme_batch_jobs(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL,
    input_payload JSONB,
    status TEXT DEFAULT 'pending',
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_batch_lineage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES public.cme_batch_jobs(id) ON DELETE CASCADE,
    source_id TEXT,
    target_id TEXT,
    relationship_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BLOCO 4: KNOWLEDGE MESH
CREATE TABLE IF NOT EXISTS public.cme_knowledge_mesh_nodes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    title TEXT,
    cognitive_weight NUMERIC DEFAULT 1.0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_knowledge_mesh_edges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source_node_id UUID NOT NULL REFERENCES public.cme_knowledge_mesh_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.cme_knowledge_mesh_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    strength NUMERIC DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- BLOCO 5: GPU AUTO SCALING
CREATE TABLE IF NOT EXISTS public.cme_autoscaling_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    worker_count_before INTEGER,
    worker_count_after INTEGER,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_cluster_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    active_workers INTEGER DEFAULT 0,
    queued_jobs INTEGER DEFAULT 0,
    avg_render_time NUMERIC,
    vram_utilization NUMERIC,
    cpu_utilization NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ENABLE RLS
ALTER TABLE public.cme_adaptive_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_neuroanalytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_playback_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_streaming_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_viewing_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_batch_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_knowledge_mesh_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_knowledge_mesh_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_autoscaling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_cluster_metrics ENABLE ROW LEVEL SECURITY;

-- POLICIES (Usando DROP POLICY se existir para evitar erro de duplicação sem usar DO block que falhou)
DROP POLICY IF EXISTS "Users can manage their own adaptive profiles" ON public.cme_adaptive_profiles;
CREATE POLICY "Users can manage their own adaptive profiles" ON public.cme_adaptive_profiles FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own neuroanalytics" ON public.cme_neuroanalytics;
CREATE POLICY "Users can view their own neuroanalytics" ON public.cme_neuroanalytics FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view segments for their projects" ON public.cme_playback_segments;
CREATE POLICY "Users can view segments for their projects" ON public.cme_playback_segments FOR SELECT USING (EXISTS (SELECT 1 FROM public.cme_video_projects WHERE id = project_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their streaming sessions" ON public.cme_streaming_sessions;
CREATE POLICY "Users can manage their streaming sessions" ON public.cme_streaming_sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their viewing analytics" ON public.cme_viewing_analytics;
CREATE POLICY "Users can manage their viewing analytics" ON public.cme_viewing_analytics FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their batch jobs" ON public.cme_batch_jobs;
CREATE POLICY "Users can manage their batch jobs" ON public.cme_batch_jobs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their batch items" ON public.cme_batch_items;
CREATE POLICY "Users can manage their batch items" ON public.cme_batch_items FOR ALL USING (EXISTS (SELECT 1 FROM public.cme_batch_jobs WHERE id = batch_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their batch lineage" ON public.cme_batch_lineage;
CREATE POLICY "Users can manage their batch lineage" ON public.cme_batch_lineage FOR ALL USING (EXISTS (SELECT 1 FROM public.cme_batch_jobs WHERE id = batch_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their knowledge mesh nodes" ON public.cme_knowledge_mesh_nodes;
CREATE POLICY "Users can manage their knowledge mesh nodes" ON public.cme_knowledge_mesh_nodes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their knowledge mesh edges" ON public.cme_knowledge_mesh_edges;
CREATE POLICY "Users can manage their knowledge mesh edges" ON public.cme_knowledge_mesh_edges FOR ALL USING (EXISTS (SELECT 1 FROM public.cme_knowledge_mesh_nodes WHERE id = source_node_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage autoscaling events" ON public.cme_autoscaling_events;
CREATE POLICY "Admins can manage autoscaling events" ON public.cme_autoscaling_events FOR ALL USING (true);

DROP POLICY IF EXISTS "Admins can manage cluster metrics" ON public.cme_cluster_metrics;
CREATE POLICY "Admins can manage cluster metrics" ON public.cme_cluster_metrics FOR ALL USING (true);

-- TIMESTAMPS TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_adaptive_profiles ON public.cme_adaptive_profiles;
CREATE TRIGGER set_updated_at_adaptive_profiles BEFORE UPDATE ON public.cme_adaptive_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_playback_segments ON public.cme_playback_segments;
CREATE TRIGGER set_updated_at_playback_segments BEFORE UPDATE ON public.cme_playback_segments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_streaming_sessions ON public.cme_streaming_sessions;
CREATE TRIGGER set_updated_at_streaming_sessions BEFORE UPDATE ON public.cme_streaming_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_batch_jobs ON public.cme_batch_jobs;
CREATE TRIGGER set_updated_at_batch_jobs BEFORE UPDATE ON public.cme_batch_jobs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_batch_items ON public.cme_batch_items;
CREATE TRIGGER set_updated_at_batch_items BEFORE UPDATE ON public.cme_batch_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
