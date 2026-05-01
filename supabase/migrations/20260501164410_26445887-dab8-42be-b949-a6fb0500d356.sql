-- Medical Knowledge Graph: Nodes
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- e.g., 'CAR-ICC-001'
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'pathology', 'pharmacology', 'physiology', etc.
    specialty TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Medical Knowledge Graph: Edges (Relationships)
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- 'prerequisite', 'caused_by', 'treated_by', 'part_of'
    strength FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(source_node_id, target_node_id, relationship_type)
);

-- Adaptive Student Cognitive Profile
CREATE TABLE IF NOT EXISTS public.adaptive_student_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    overall_friction_score FLOAT DEFAULT 0.0,
    cognitive_load_estimate FLOAT DEFAULT 0.0,
    preferred_modality TEXT DEFAULT 'video', -- 'video', 'text', 'quiz', 'active_recall'
    mastery_map JSONB DEFAULT '{}'::jsonb, -- node_id -> mastery_level (0.0 to 1.0)
    last_intervention_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adaptive Interventions Log
CREATE TABLE IF NOT EXISTS public.adaptive_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL, -- 'high_friction', 'quiz_fail_streak', 'proactive_review'
    action_taken TEXT NOT NULL, -- 'inject_micro_review', 'adjust_difficulty', 'suggest_feynman'
    context_node_id UUID REFERENCES public.knowledge_nodes(id),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id),
    effectiveness_score FLOAT, -- measured after 24h/48h
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Link existing segments to knowledge nodes
ALTER TABLE public.lesson_segments ADD COLUMN IF NOT EXISTS knowledge_node_id UUID REFERENCES public.knowledge_nodes(id);
ALTER TABLE public.video_lesson_quizzes ADD COLUMN IF NOT EXISTS knowledge_node_id UUID REFERENCES public.knowledge_nodes(id);

-- Enable RLS
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_interventions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Everyone can view the knowledge graph" ON public.knowledge_nodes FOR SELECT USING (true);
CREATE POLICY "Everyone can view knowledge edges" ON public.knowledge_edges FOR SELECT USING (true);
CREATE POLICY "Users can view their own adaptive profile" ON public.adaptive_student_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own interventions" ON public.adaptive_interventions FOR SELECT USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can manage knowledge graph" ON public.knowledge_nodes FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.uid() = id AND raw_user_meta_data->>'role' = 'admin'));
CREATE POLICY "Admins can manage knowledge edges" ON public.knowledge_edges FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.uid() = id AND raw_user_meta_data->>'role' = 'admin'));

-- Function to update adaptive profile based on friction events
CREATE OR REPLACE FUNCTION public.process_adaptive_friction_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Update student profile logic here based on new video_segment_events
    -- This is the heart of the Adaptive Curriculum Engine
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
