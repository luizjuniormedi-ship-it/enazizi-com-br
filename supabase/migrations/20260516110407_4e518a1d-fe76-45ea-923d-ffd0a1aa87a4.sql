-- Cognitive Profiles
CREATE TABLE IF NOT EXISTS public.cognitive_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    learning_speed_index NUMERIC DEFAULT 1.0, -- 1.0 is average
    fatigue_tolerance_index NUMERIC DEFAULT 1.0,
    retention_efficiency NUMERIC DEFAULT 1.0,
    learning_style_profile JSONB DEFAULT '{"dominant": "visual", "weights": {"visual": 0.33, "auditory": 0.33, "reading": 0.34}}'::jsonb,
    peak_performance_hours INTEGER[] DEFAULT '{8, 9, 10, 11, 14, 15, 16, 17}',
    cognitive_resistance_score NUMERIC DEFAULT 0.0,
    pattern_recognition_accuracy NUMERIC DEFAULT 0.0,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Self-Healing Incidents
CREATE TABLE IF NOT EXISTS public.self_healing_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL,
    incident_type TEXT NOT NULL, -- 'hallucination', 'timeout', 'quality_regression', 'context_loss'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    symptoms JSONB,
    fallback_activated BOOLEAN DEFAULT FALSE,
    fallback_model_used TEXT,
    resolution_status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
    mitigation_details TEXT,
    metadata JSONB
);

-- Cognitive Predictions
CREATE TABLE IF NOT EXISTS public.cognitive_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prediction_type TEXT NOT NULL, -- 'churn', 'approval', 'overload', 'regression'
    probability NUMERIC NOT NULL, -- 0.0 to 1.0
    time_horizon INTERVAL, -- e.g., '30 days'
    confidence_score NUMERIC,
    contributing_factors JSONB, -- list of signals that led to this prediction
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recovery Interventions (Autonomous Actions)
CREATE TABLE IF NOT EXISTS public.recovery_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    intervention_type TEXT NOT NULL, -- 'load_reduction', 'review_surge', 'recovery_mode_activation'
    reason_code TEXT NOT NULL, -- 'high_fatigue', 'critical_retention_drop', 'pattern_failure'
    action_details JSONB, -- details of what was changed in the planner/system
    automatic BOOLEAN DEFAULT TRUE,
    impact_score NUMERIC, -- measured after 24-48h
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Medical Vision Analysis (Multimodal)
CREATE TABLE IF NOT EXISTS public.medical_vision_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id UUID, -- reference to original storage object
    modality TEXT NOT NULL, -- 'ECG', 'RX', 'TC', 'MR', 'HISTO'
    ai_interpretation JSONB, -- structured findings
    confidence NUMERIC,
    clinical_relevance_score INTEGER, -- 1-5
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add user_id to ai_cost_metrics for per-user tracking
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_cost_metrics' AND column_name='user_id') THEN
        ALTER TABLE public.ai_cost_metrics ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.cognitive_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_healing_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_vision_analysis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own cognitive profile" ON public.cognitive_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all cognitive profiles" ON public.cognitive_profiles FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can view all self-healing incidents" ON public.self_healing_incidents FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their own predictions" ON public.cognitive_predictions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all predictions" ON public.cognitive_predictions FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their own recovery interventions" ON public.recovery_interventions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all recovery interventions" ON public.recovery_interventions FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can view their own vision analysis" ON public.medical_vision_analysis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all vision analysis" ON public.medical_vision_analysis FOR ALL USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
