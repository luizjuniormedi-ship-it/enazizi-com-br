-- Add link from Scene Graphs to Lessons
ALTER TABLE public.cme_scene_graphs ADD COLUMN IF NOT EXISTS video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE;

-- CME Scene Graph Nodes
CREATE TABLE IF NOT EXISTS public.cme_scene_graph_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_graph_id UUID REFERENCES public.cme_scene_graphs(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL, -- 'scene', 'transition', 'overlay', 'voice', 'reinforcement'
    start_second NUMERIC NOT NULL,
    end_second NUMERIC NOT NULL,
    semantic_role TEXT, -- 'intro', 'clinical_case', 'pathophysiology', 'treatment', 'outro'
    transition_profile TEXT, -- 'crossfade', 'cut', 'motion_blur'
    cognitive_intensity NUMERIC DEFAULT 1.0, -- 0.0 to 5.0
    reinforcement_type TEXT, -- 'flashcard', 'summary', 'feynman_prompt'
    render_payload JSONB NOT NULL, -- Specific instructions for the render engine
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CME Render Outputs
CREATE TABLE IF NOT EXISTS public.cme_render_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    output_type TEXT NOT NULL, -- 'master_mp4', 'hls_chunk', 'preview_mp4', 'voice_only'
    resolution TEXT, -- '1080p', '720p', '480p'
    codec TEXT DEFAULT 'h.264',
    duration_seconds NUMERIC,
    file_size_bytes BIGINT,
    output_url TEXT NOT NULL,
    hls_manifest_url TEXT,
    render_quality_score NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CME HLS Manifests
CREATE TABLE IF NOT EXISTS public.cme_hls_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    master_manifest_url TEXT NOT NULL,
    resolution_profiles JSONB, -- list of profile URLs (1080p, 720p, etc)
    segment_count INTEGER,
    average_bitrate INTEGER,
    latency_score NUMERIC,
    playback_health_score NUMERIC DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CME Variant Generation Logs
CREATE TABLE IF NOT EXISTS public.cme_variant_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    variant_type TEXT NOT NULL, -- 'full', 'recovery', 'exam_sprint', 'feynman', 'micro'
    adaptation_reason TEXT, -- 'high_fatigue', 'low_retention', 'exam_period'
    pacing_adjustments JSONB,
    narrative_adjustments JSONB,
    reinforcement_adjustments JSONB,
    fatigue_adjustments JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CME Autonomous Optimizations
CREATE TABLE IF NOT EXISTS public.cme_autonomous_optimizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    detected_problem TEXT, -- 'retention_drop_at_30s', 'high_fatigue_index'
    optimization_type TEXT, -- 'split_scene', 'add_reinforcement', 'pacing_slowdown'
    generated_variant_id UUID REFERENCES public.cme_variant_generation_logs(id),
    expected_retention_gain NUMERIC,
    applied_at TIMESTAMP WITH TIME ZONE,
    effectiveness_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update ai_video_lessons with factory metadata
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS current_variant TEXT DEFAULT 'full_lecture';
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS cinematic_intro_url TEXT;
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS cinematic_outro_url TEXT;
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS cme_project_id UUID REFERENCES public.cme_video_projects(id);

-- Enable RLS
ALTER TABLE public.cme_scene_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_hls_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_variant_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_autonomous_optimizations ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "Admins manage factory nodes" ON public.cme_scene_graph_nodes FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins manage render outputs" ON public.cme_render_outputs FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins manage hls manifests" ON public.cme_hls_manifests FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins manage variants" ON public.cme_variant_generation_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins manage optimizations" ON public.cme_autonomous_optimizations FOR ALL TO authenticated USING (true);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_cme_scene_node_graph ON public.cme_scene_graph_nodes(scene_graph_id);
CREATE INDEX IF NOT EXISTS idx_cme_hls_lesson ON public.cme_hls_manifests(video_lesson_id);
CREATE INDEX IF NOT EXISTS idx_cme_variant_lesson ON public.cme_variant_generation_logs(video_lesson_id);
CREATE INDEX IF NOT EXISTS idx_cme_optimization_lesson ON public.cme_autonomous_optimizations(video_lesson_id);
