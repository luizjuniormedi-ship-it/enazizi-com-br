-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Pedagogical Health Indices (Expansion)
CREATE TABLE IF NOT EXISTS public.pedagogical_health_indices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    health_score NUMERIC DEFAULT 100,
    retention_rate NUMERIC,
    forgetting_rate NUMERIC,
    mastery_depth NUMERIC,
    recovery_efficiency NUMERIC,
    longitudinal_consistency NUMERIC,
    cognitive_stability NUMERIC,
    response_speed_ms INTEGER,
    recall_quality NUMERIC,
    passive_review_ratio NUMERIC,
    perceived_difficulty NUMERIC,
    cognitive_fatigue NUMERIC,
    burnout_risk NUMERIC,
    saturation_level NUMERIC,
    false_confidence_score NUMERIC,
    performance_variability NUMERIC,
    knowledge_transfer_rate NUMERIC,
    clinical_integration_score NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Cognitive States
CREATE TYPE cognitive_state_type AS ENUM (
    'hyperfocus', 'fatigue', 'saturation', 'ansiedade', 'baixa_energia', 
    'alta_performance', 'recuperacao', 'desorganizacao', 'burnout_inicial', 
    'queda_motivacional', 'estabilidade_ideal'
);

CREATE TABLE IF NOT EXISTS public.cognitive_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    state cognitive_state_type NOT NULL,
    intensity NUMERIC DEFAULT 1.0,
    trigger_source TEXT, -- e.g., 'quiz', 'session_time', 'tutor_interaction'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Medical Knowledge Graph
CREATE TABLE IF NOT EXISTS public.medical_knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    category TEXT, -- symptom, disease, drug, physiology, etc.
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.medical_knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_node_id UUID REFERENCES public.medical_knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID REFERENCES public.medical_knowledge_nodes(id) ON DELETE CASCADE,
    relationship_type TEXT, -- 'causes', 'treats', 'diagnoses', 'pathophysiology_of'
    weight NUMERIC DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(source_node_id, target_node_id, relationship_type)
);

-- User-specific Mastery over Knowledge Graph
CREATE TABLE IF NOT EXISTS public.user_knowledge_graph_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id UUID REFERENCES public.medical_knowledge_nodes(id) ON DELETE CASCADE,
    mastery_level NUMERIC DEFAULT 0, -- 0 to 1
    last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, node_id)
);

-- 4. Approval Predictions
CREATE TABLE IF NOT EXISTS public.approval_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    probability NUMERIC NOT NULL,
    trend TEXT, -- 'improving', 'stable', 'declining'
    risk_level TEXT, -- 'low', 'medium', 'high', 'critical'
    estimated_exam_score NUMERIC,
    critical_disciplines TEXT[],
    recommendations TEXT[],
    metrics_snapshot JSONB, -- Snapshot of health/tri/fsrs used for this prediction
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Pedagogical Quality Audits (Anti-Hallucination)
CREATE TABLE IF NOT EXISTS public.pedagogical_quality_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interaction_id UUID, -- References tutor session or quiz attempt
    content_type TEXT, -- 'tutor_response', 'question_generation'
    quality_score NUMERIC, -- 0 to 100
    medical_coherence_passed BOOLEAN,
    guideline_compliance_passed BOOLEAN,
    safety_check_passed BOOLEAN,
    detected_hallucinations TEXT[],
    audit_log JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Error Pattern Analytics
CREATE TABLE IF NOT EXISTS public.error_pattern_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_name TEXT, -- e.g., 'Confusion between COPD and Heart Failure'
    correlation_disciplines TEXT[],
    frequency INTEGER DEFAULT 1,
    impact_on_planner NUMERIC,
    suggested_recovery_actions TEXT[],
    last_occurrence_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. RLS Policies
ALTER TABLE public.pedagogical_health_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_knowledge_graph_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_quality_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_pattern_analytics ENABLE ROW LEVEL SECURITY;

-- User Policies
CREATE POLICY "Users can view their own health indices" ON public.pedagogical_health_indices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own cognitive states" ON public.cognitive_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own knowledge mastery" ON public.user_knowledge_graph_mastery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own approval predictions" ON public.approval_predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own error patterns" ON public.error_pattern_analytics FOR SELECT USING (auth.uid() = user_id);

-- Public Knowledge Graph (Viewable by all)
CREATE POLICY "Public knowledge nodes are viewable by all" ON public.medical_knowledge_nodes FOR SELECT USING (true);
CREATE POLICY "Public knowledge edges are viewable by all" ON public.medical_knowledge_edges FOR SELECT USING (true);

-- Triggers for Updated At
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pedagogical_health_indices_updated_at
    BEFORE UPDATE ON public.pedagogical_health_indices
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
