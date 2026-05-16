-- 1. Cognitive Observatory Tables
CREATE TABLE public.cognitive_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    overall_retention NUMERIC DEFAULT 0,
    recovery_success_rate NUMERIC DEFAULT 0,
    average_time_to_mastery INTERVAL,
    fatigue_score NUMERIC DEFAULT 0,
    cognitive_pressure NUMERIC DEFAULT 0,
    memory_decay_rate NUMERIC DEFAULT 0,
    overload_flag BOOLEAN DEFAULT FALSE,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.retention_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    topic TEXT NOT NULL,
    subtopic TEXT,
    predicted_stability NUMERIC,
    real_retention NUMERIC,
    lapses_count INTEGER DEFAULT 0,
    last_review_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.fatigue_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    session_id UUID,
    overload_score NUMERIC,
    abandonment_risk NUMERIC,
    error_rate_spike BOOLEAN DEFAULT FALSE,
    time_per_question_spike BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.recovery_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    topic TEXT NOT NULL,
    recovery_start_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    recovery_end_at TIMESTAMP WITH TIME ZONE,
    initial_score NUMERIC,
    final_score NUMERIC,
    success BOOLEAN,
    reincidência_rate NUMERIC
);

CREATE TABLE public.tutor_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    conversation_id UUID,
    topic TEXT,
    pedagogical_impact_score NUMERIC,
    recall_effectiveness NUMERIC,
    average_depth_score NUMERIC,
    hallucination_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.planner_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users NOT NULL,
    recommendation_id UUID,
    accepted BOOLEAN,
    progress_delta NUMERIC,
    retention_boost NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Medical Knowledge Graph
CREATE TABLE public.medical_knowledge_graph (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity TEXT NOT NULL,
    relation_type TEXT NOT NULL, -- e.g., 'causes', 'treats', 'contraindicated_in', 'guideline_for'
    target_entity TEXT NOT NULL,
    strength NUMERIC DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. AI Governance Layer
CREATE TABLE public.ai_governance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT NOT NULL,
    model_name TEXT NOT NULL,
    incident_type TEXT, -- 'hallucination', 'drift', 'missing_block', 'unsafe_response'
    severity TEXT,
    details JSONB,
    audited_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. IRT/TRI Parameters (Integrating with questions_bank)
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS tri_discrimination NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS tri_guessing NUMERIC DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS latent_ability_theta NUMERIC;

-- 5. Row Level Security (RLS)
ALTER TABLE public.cognitive_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatigue_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_knowledge_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_governance_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Cognitive Analytics
CREATE POLICY "Users can view their own cognitive analytics" 
ON public.cognitive_analytics FOR SELECT USING (auth.uid() = user_id);

-- Knowledge Graph is public read, admin write
CREATE POLICY "Medical Knowledge Graph viewable by all" 
ON public.medical_knowledge_graph FOR SELECT USING (true);

-- Repeat similar policies for other user-specific tables
CREATE POLICY "Retention metrics viewable by owner" ON public.retention_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Fatigue metrics viewable by owner" ON public.fatigue_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Recovery metrics viewable by owner" ON public.recovery_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tutor effectiveness viewable by owner" ON public.tutor_effectiveness FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Planner effectiveness viewable by owner" ON public.planner_effectiveness FOR SELECT USING (auth.uid() = user_id);

-- Triggers for computed stats (simplified version)
CREATE OR REPLACE FUNCTION public.update_cognitive_pressure()
RETURNS TRIGGER AS $$
BEGIN
    -- Logic to update overall pressure when new fatigue metrics are inserted
    UPDATE public.cognitive_analytics 
    SET cognitive_pressure = (SELECT AVG(overload_score) FROM public.fatigue_metrics WHERE user_id = NEW.user_id),
        computed_at = now()
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_cognitive_pressure
AFTER INSERT ON public.fatigue_metrics
FOR EACH ROW EXECUTE FUNCTION public.update_cognitive_pressure();
