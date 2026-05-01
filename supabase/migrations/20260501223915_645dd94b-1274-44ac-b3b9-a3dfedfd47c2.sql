-- Phase 3: Cognitive Analytics
CREATE TABLE IF NOT EXISTS public.cme_cognitive_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    pacing_score NUMERIC CHECK (pacing_score >= 0 AND pacing_score <= 100),
    cognitive_density NUMERIC CHECK (cognitive_density >= 0 AND cognitive_density <= 100),
    overload_risk NUMERIC CHECK (overload_risk >= 0 AND overload_risk <= 100),
    feynman_depth INTEGER CHECK (feynman_depth >= 1 AND feynman_depth <= 5),
    active_recall_score NUMERIC,
    visual_complexity NUMERIC,
    retention_prediction NUMERIC,
    learner_profile TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 4: Adaptive Optimization
CREATE TABLE IF NOT EXISTS public.cme_learning_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID,
    chapter_id UUID,
    engagement_score NUMERIC,
    completion_rate NUMERIC,
    replay_count INTEGER DEFAULT 0,
    technical_depth_feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_adaptive_generation_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    preferred_pacing NUMERIC DEFAULT 1.0,
    preferred_depth INTEGER DEFAULT 3,
    visual_preference TEXT DEFAULT 'balanced',
    fsrs_data JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Phase 7: Knowledge Lineage (Check if missing or expand)
CREATE TABLE IF NOT EXISTS public.cme_knowledge_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_id UUID NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID NOT NULL,
    transformation_logic TEXT,
    confidence_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 8: Hardening & Incidents
DO $$ BEGIN
    CREATE TYPE public.cme_incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.cme_system_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component TEXT NOT NULL,
    severity public.cme_incident_severity DEFAULT 'medium',
    error_code TEXT,
    error_message TEXT,
    stack_trace TEXT,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_pipeline_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    state_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_recovery_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID REFERENCES public.cme_system_incidents(id),
    render_job_id UUID REFERENCES public.cme_render_jobs(id),
    recovery_strategy TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_cognitive_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_adaptive_generation_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_knowledge_lineage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_system_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_pipeline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_recovery_runs ENABLE ROW LEVEL SECURITY;

-- Enterprise Policies
CREATE POLICY "Admins can view all cognitive analysis" ON public.cme_cognitive_analysis FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND (user_type = 'admin' OR user_type = 'super_admin')));
CREATE POLICY "Users can view their own adaptive profiles" ON public.cme_adaptive_generation_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System incidents viewable by operators" ON public.cme_system_incidents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND (user_type = 'admin' OR user_type = 'gpu_operator' OR user_type = 'super_admin')));

-- Triggers for updated_at
DO $$ BEGIN
    CREATE TRIGGER update_cme_adaptive_profiles_modtime BEFORE UPDATE ON public.cme_adaptive_generation_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
