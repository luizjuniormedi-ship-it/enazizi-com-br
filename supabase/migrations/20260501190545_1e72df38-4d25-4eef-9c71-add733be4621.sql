-- Phase 1: Visual Grammar Engine
CREATE TABLE IF NOT EXISTS public.cme_visual_grammar_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialty TEXT NOT NULL, -- 'cardiology', 'neuro', 'surgery', etc.
    grammar_type TEXT NOT NULL, -- 'procedural', 'pathophysiological', 'emergency'
    motion_profile TEXT, -- 'smooth', 'urgent', 'detailed'
    transition_profile TEXT, -- 'semantic_zoom', 'cinematic_cut'
    overlay_density NUMERIC DEFAULT 1.0,
    cognitive_density NUMERIC DEFAULT 1.0,
    animation_rules JSONB DEFAULT '{}'::jsonb,
    pacing_rules JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 2: Autonomous Director AI
CREATE TABLE IF NOT EXISTS public.cme_director_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    scene_node_id UUID REFERENCES public.cme_scene_graph_nodes(id) ON DELETE CASCADE,
    decision_type TEXT NOT NULL, -- 'zoom_in', 'slow_down', 'inject_reinforcement', 'pause'
    reasoning TEXT,
    cognitive_goal TEXT, -- 'maximize_retention', 'reduce_fatigue'
    visual_goal TEXT, -- 'highlight_anatomical_detail'
    pacing_adjustment NUMERIC,
    expected_retention_gain NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 3: Cinematic Quality AI
CREATE TABLE IF NOT EXISTS public.cme_quality_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    quality_score NUMERIC NOT NULL, -- Global cinematic score
    fatigue_score NUMERIC, -- Predicted visual fatigue
    overload_score NUMERIC, -- Predicted semantic overload
    continuity_score NUMERIC,
    drift_probability NUMERIC, -- Probability of student losing attention
    retention_projection NUMERIC,
    analysis_payload JSONB,
    is_safe_for_publication BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 4: Adaptive Voice Engine
CREATE TABLE IF NOT EXISTS public.cme_voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_name TEXT NOT NULL UNIQUE, -- 'recovery', 'sprint', 'feynman', 'intensive'
    speaking_speed NUMERIC NOT NULL DEFAULT 1.0,
    pause_density NUMERIC NOT NULL DEFAULT 1.0,
    emotional_intensity NUMERIC DEFAULT 0.5,
    cognitive_load_profile TEXT, -- 'low', 'adaptive', 'high'
    pronunciation_style TEXT DEFAULT 'neutral_medical',
    reinforcement_style TEXT, -- 'supportive', 'assertive'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 5: GPU Cinematic Cluster Monitoring
CREATE TABLE IF NOT EXISTS public.cme_render_cluster_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES public.cme_gpu_workers(id) ON DELETE CASCADE,
    gpu_temperature NUMERIC,
    vram_usage_mb INTEGER,
    render_latency_ms INTEGER,
    active_jobs INTEGER,
    thermal_state TEXT, -- 'nominal', 'high', 'throttling'
    queue_pressure NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Evolving render_jobs for autonomous direction
ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS director_ai_id UUID;
ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS visual_grammar_id UUID REFERENCES public.cme_visual_grammar_profiles(id);
ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS voice_profile_id UUID REFERENCES public.cme_voice_profiles(id);

-- Evolving video lessons for quality gating
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS visual_fatigue_score NUMERIC;
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS narrative_clarity_score NUMERIC;

-- Indexes for observability
CREATE INDEX IF NOT EXISTS idx_cme_director_render ON public.cme_director_decisions(render_job_id);
CREATE INDEX IF NOT EXISTS idx_cme_quality_lesson ON public.cme_quality_analysis(video_lesson_id);
CREATE INDEX IF NOT EXISTS idx_cme_cluster_worker ON public.cme_render_cluster_metrics(worker_id);

-- Enable RLS
ALTER TABLE public.cme_visual_grammar_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_director_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_quality_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_cluster_metrics ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "Admins manage grammar" ON public.cme_visual_grammar_profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins view director decisions" ON public.cme_director_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins view quality analysis" ON public.cme_quality_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage voice profiles" ON public.cme_voice_profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins view cluster metrics" ON public.cme_render_cluster_metrics FOR SELECT TO authenticated USING (true);
