-- CME Video Projects: The orchestrator of the pipeline
CREATE TABLE public.cme_video_projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    topic_id UUID REFERENCES public.knowledge_nodes(id),
    status TEXT NOT NULL DEFAULT 'draft', -- draft, planning, scripting, rendering, published, failed
    target_audience TEXT, -- beginner, advanced, exam_prep
    config JSONB DEFAULT '{}'::jsonb, -- voice_id, visual_style, aspect_ratio
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Semantic Knowledge Planner: The "brain" before the "voice"
CREATE TABLE public.cme_semantic_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    semantic_outline JSONB NOT NULL, -- Concepts, causality, clinical relations
    prerequisite_graph JSONB,
    cognitive_difficulty_map JSONB,
    clinical_priority_points TEXT[],
    exam_priority_points TEXT[],
    retention_hotspots JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Narrative Medical Engine: The storytelling layer
CREATE TABLE public.cme_narrative_scripts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    cinematic_script JSONB NOT NULL, -- Narration blocks, visual cues, transitions
    chapters JSONB NOT NULL, -- Structured chapters for navigation
    pacing_hints JSONB, -- Emphasis, pauses, emotion markers
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Cognitive Pacing Engine: Rhythm and intensity
CREATE TABLE public.cme_cognitive_pacing (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    timeline_events JSONB NOT NULL, -- Timing for every concept
    intensity_curve JSONB NOT NULL, -- Targeted cognitive load over time
    fatigue_protection_points FLOAT[], -- Timestamp markers for breaks/slowdowns
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Video Assets: Audio, scenes, and fragments
CREATE TABLE public.cme_video_assets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL, -- audio_narration, scene_render, thumbnail, hls_playlist
    url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- duration, resolution, chapter_ref
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Multimodal Analytics: How students interact with CME
CREATE TABLE public.cme_multimodal_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.adaptive_student_profiles(user_id),
    project_id UUID REFERENCES public.cme_video_projects(id),
    watch_time_seconds INTEGER NOT NULL DEFAULT 0,
    replay_count INTEGER DEFAULT 0,
    completion_rate FLOAT DEFAULT 0,
    avg_pacing_efficiency FLOAT, -- How well the pacing matched student speed
    stress_spikes JSONB DEFAULT '[]'::jsonb,
    chapter_retention JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Extend student profiles for CME personalization
ALTER TABLE public.adaptive_student_profiles 
ADD COLUMN IF NOT EXISTS cme_preferences JSONB DEFAULT '{
    "preferred_voice": "neutral_professional",
    "base_pacing": 1.0,
    "visual_complexity": "balanced",
    "interactive_checkpoints": true
}'::jsonb;

-- Enable RLS
ALTER TABLE public.cme_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_semantic_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_narrative_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_cognitive_pacing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_video_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_multimodal_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for Admin (Simplified for the engine)
CREATE POLICY "Admins can manage CME projects" ON public.cme_video_projects FOR ALL USING (true);
CREATE POLICY "Admins can manage CME semantic plans" ON public.cme_semantic_plans FOR ALL USING (true);
CREATE POLICY "Admins can manage CME scripts" ON public.cme_narrative_scripts FOR ALL USING (true);
CREATE POLICY "Admins can manage CME pacing" ON public.cme_cognitive_pacing FOR ALL USING (true);
CREATE POLICY "Admins can manage CME assets" ON public.cme_video_assets FOR ALL USING (true);

-- Policies for Students
CREATE POLICY "Students can view published projects" ON public.cme_video_projects FOR SELECT USING (status = 'published');
CREATE POLICY "Students can view their own analytics" ON public.cme_multimodal_analytics FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can insert their own analytics" ON public.cme_multimodal_analytics FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Updated at trigger
CREATE TRIGGER update_cme_video_projects_updated_at
BEFORE UPDATE ON public.cme_video_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();