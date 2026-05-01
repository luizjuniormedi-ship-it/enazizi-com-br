-- FASE 2: PLAYER COGNITIVO COM HOTSPOTS
CREATE TABLE public.cme_playback_hotspots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    segment_id TEXT, 
    hotspot_type TEXT NOT NULL, -- replay_hotspot, fatigue_zone, abandon_zone, tutor_hotspot, quiz_difficulty
    friction_score FLOAT DEFAULT 0.0,
    replay_density FLOAT DEFAULT 0.0,
    fatigue_density FLOAT DEFAULT 0.0,
    tutor_density FLOAT DEFAULT 0.0,
    quiz_error_density FLOAT DEFAULT 0.0,
    abandon_density FLOAT DEFAULT 0.0,
    retention_drop FLOAT DEFAULT 0.0,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- FASE 3: SCORING EXPLICÁVEL
CREATE TABLE public.cme_explainable_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    score_type TEXT NOT NULL, -- pacing, narrative, cinematic, retention, fatigue_protection, replay_reduction, semantic_continuity, cognitive_load
    score_value FLOAT NOT NULL,
    explanation TEXT,
    contributing_factors JSONB DEFAULT '[]'::jsonb,
    detected_risks JSONB DEFAULT '[]'::jsonb,
    optimization_recommendations JSONB DEFAULT '[]'::jsonb,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- FASE 4: GOVERNANÇA MULTIMODAL
CREATE TABLE public.cme_governance_reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    review_type TEXT NOT NULL, -- semantic, narrative, medical, cinematic, adaptive, benchmark_validation
    reviewer_id UUID REFERENCES auth.users(id),
    review_status TEXT DEFAULT 'pending', -- pending, approved, rejected, blocked
    review_notes TEXT,
    blocking_reasons JSONB DEFAULT '[]'::jsonb,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- FASE 5: TIMINGS ADAPTATIVOS
CREATE TABLE public.cme_adaptive_timing_maps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    variant_type TEXT DEFAULT 'standard', -- standard, recovery, feynman, sprint
    pacing_curve JSONB DEFAULT '[]'::jsonb,
    reinforcement_curve JSONB DEFAULT '[]'::jsonb,
    recovery_curve JSONB DEFAULT '[]'::jsonb,
    semantic_revisit_map JSONB DEFAULT '[]'::jsonb,
    fatigue_protection_map JSONB DEFAULT '[]'::jsonb,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- FASE 1: FEATURE FLAGS PARA CME v3.0
CREATE TABLE IF NOT EXISTS public.cme_v3_feature_flags (
    name TEXT PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO public.cme_v3_feature_flags (name, is_enabled)
VALUES 
    ('cme_reference_engine_enabled', true),
    ('cme_similarity_engine_enabled', true),
    ('cme_adaptive_pacing_enabled', true),
    ('cme_hotspot_engine_enabled', true),
    ('cme_governance_enabled', true)
ON CONFLICT (name) DO UPDATE SET is_enabled = true, updated_at = now();

-- Enable RLS
ALTER TABLE public.cme_playback_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_explainable_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_governance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_adaptive_timing_maps ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins manage CME hotspots" ON public.cme_playback_hotspots FOR ALL USING (true);
CREATE POLICY "Admins manage CME explainable scores" ON public.cme_explainable_scores FOR ALL USING (true);
CREATE POLICY "Admins manage CME governance" ON public.cme_governance_reviews FOR ALL USING (true);
CREATE POLICY "Admins manage CME timing maps" ON public.cme_adaptive_timing_maps FOR ALL USING (true);