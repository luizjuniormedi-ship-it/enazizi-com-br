-- 1. Cinematic Reference Profiles: The benchmark data learned from official references
CREATE TABLE public.cme_cinematic_reference_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_name TEXT NOT NULL,
    reference_type TEXT DEFAULT 'internal_benchmark', -- internal_benchmark, expert_reference, high_retention_sample
    video_duration_seconds INTEGER,
    
    -- Pacing & Transition Profiles
    pacing_profile JSONB DEFAULT '{}'::jsonb, -- avg_pacing, time_per_concept, zoom_frequency
    transition_profile JSONB DEFAULT '{}'::jsonb, -- transition_speed, pattern_type
    
    -- Narrative & Chapter Profiles
    narrative_profile JSONB DEFAULT '{}'::jsonb, -- hook_type, clinic_progression_pattern, feynman_pattern
    chapter_profile JSONB DEFAULT '{}'::jsonb, -- avg_chapter_duration, checkpoint_frequency
    storytelling_profile JSONB DEFAULT '{}'::jsonb, -- hook_style, recap_pattern
    
    -- Cognitive & Visual Profiles
    visual_density_profile JSONB DEFAULT '{}'::jsonb, -- text_density, visual_complexity_score
    cognitive_curve JSONB DEFAULT '[]'::jsonb, -- cognitive_load over time
    cinematic_curve JSONB DEFAULT '[]'::jsonb, -- cinematic_intensity over time
    semantic_focus_map JSONB DEFAULT '{}'::jsonb, -- keyword_timing, emphasis_distribution
    
    -- Retention & Fatigue
    retention_profile JSONB DEFAULT '{}'::jsonb, -- reinforcement_frequency, micro_recall_pattern
    fatigue_protection_profile JSONB DEFAULT '{}'::jsonb, -- pause_schedule, density_reduction_logic
    replay_hotspot_profile JSONB DEFAULT '[]'::jsonb, -- historical hotspots in similar references
    
    -- Visual & Audio Curves
    visual_attention_profile JSONB DEFAULT '[]'::jsonb, -- attention_guidance_markers
    emotional_curve JSONB DEFAULT '[]'::jsonb, -- voice_intensity and emotional_peaks
    
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Cinematic Similarity Reports: Comparing CME output with benchmarks
CREATE TABLE public.cme_cinematic_similarity_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    reference_profile_id UUID REFERENCES public.cme_cinematic_reference_profiles(id),
    
    -- Similarity Metrics (0-1 scale)
    pacing_similarity_score NUMERIC,
    narrative_similarity_score NUMERIC,
    retention_similarity_score NUMERIC,
    cinematic_similarity_score NUMERIC,
    fatigue_similarity_score NUMERIC,
    overall_similarity_score NUMERIC,
    
    metadata JSONB DEFAULT '{}'::jsonb, -- detailed comparison breakdown
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Detailed Multimodal Quality Scoring
CREATE TABLE public.cme_cinematic_quality_score (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    
    -- Scoring Pillars
    estimated_retention_score NUMERIC,
    narrative_flow_score NUMERIC,
    pacing_efficiency_score NUMERIC,
    multimodal_continuity_score NUMERIC,
    fatigue_protection_score NUMERIC,
    drift_reduction_score NUMERIC,
    
    -- Final Aggregated Score
    overall_cinematic_score NUMERIC, -- 0-10
    
    verdict TEXT, -- pass, conditional, fail
    reviewer_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Expand existing tables for v3.0 Engine
ALTER TABLE public.cme_render_jobs
ADD COLUMN IF NOT EXISTS reference_profile_id UUID REFERENCES public.cme_cinematic_reference_profiles(id),
ADD COLUMN IF NOT EXISTS cinematic_quality_score NUMERIC DEFAULT 0;

-- Enable RLS
ALTER TABLE public.cme_cinematic_reference_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_cinematic_similarity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_cinematic_quality_score ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Admins can manage reference profiles" ON public.cme_cinematic_reference_profiles FOR ALL USING (true);
CREATE POLICY "Admins can view similarity reports" ON public.cme_cinematic_similarity_reports FOR SELECT USING (true);
CREATE POLICY "Admins can view quality scores" ON public.cme_cinematic_quality_score FOR SELECT USING (true);

-- Triggers for project-level score aggregation
CREATE OR REPLACE FUNCTION public.aggregate_cme_quality_to_project()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.cme_video_projects
    SET quality_score = NEW.overall_cinematic_score
    WHERE id = (SELECT project_id FROM public.cme_render_jobs WHERE id = NEW.render_job_id);
    
    -- Also sync to render_job
    UPDATE public.cme_render_jobs
    SET cinematic_quality_score = NEW.overall_cinematic_score
    WHERE id = NEW.render_job_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cme_quality_sync_trigger
AFTER INSERT OR UPDATE ON public.cme_cinematic_quality_score
FOR EACH ROW
EXECUTE FUNCTION public.aggregate_cme_quality_to_project();