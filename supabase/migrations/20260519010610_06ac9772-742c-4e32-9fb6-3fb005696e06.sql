-- 1. Pedagogical Health Indices
CREATE TABLE public.pedagogical_health_indices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    health_score NUMERIC(5,2) DEFAULT 100, -- 0-100
    retention_factor NUMERIC(5,2),
    consistency_score NUMERIC(5,2),
    fatigue_index NUMERIC(5,2),
    cognitive_load NUMERIC(5,2),
    risk_of_abandonment NUMERIC(5,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Pedagogical Memory Layer (Student Profiles 2.0)
CREATE TABLE public.pedagogical_memory_layer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    optimal_study_hours INT[] DEFAULT '{}', -- [8, 9, 20]
    error_patterns TEXT[] DEFAULT '{}', -- ['anatomy_spatial', 'drug_dosage_math']
    difficulty_tolerance NUMERIC(3,2) DEFAULT 0.5,
    preferred_teaching_style TEXT DEFAULT 'socratic',
    session_stamina_minutes INT DEFAULT 45,
    longitudinal_data JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Quality Lock Validations (AI Content Integrity)
CREATE TABLE public.quality_lock_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL, -- 'question', 'flashcard', 'summary'
    content_id UUID NOT NULL,
    valid_pedagogical_depth BOOLEAN DEFAULT FALSE,
    hallucination_check BOOLEAN DEFAULT FALSE,
    coherence_score NUMERIC(3,2),
    auditor_model TEXT,
    audit_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Engine Governance Logs
CREATE TABLE public.engine_governance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engine_name TEXT NOT NULL, -- 'fsrs', 'planner', 'tutor'
    event_type TEXT NOT NULL, -- 'drift_detected', 'mission_impossible', 'regression'
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    details JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pedagogical_health_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_memory_layer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_lock_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_governance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own health" ON public.pedagogical_health_indices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own memory" ON public.pedagogical_memory_layer FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all health" ON public.pedagogical_health_indices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins view governance" ON public.engine_governance_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins view quality locks" ON public.quality_lock_validations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Trigger for Memory Layer Updated At
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_pedagogical_memory_updated
BEFORE UPDATE ON public.pedagogical_memory_layer
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
