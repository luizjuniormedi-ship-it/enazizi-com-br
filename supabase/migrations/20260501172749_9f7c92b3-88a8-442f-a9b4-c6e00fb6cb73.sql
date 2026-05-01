-- Phase 1: Longitudinal Infrastructure

-- 1. Adaptive Schedule Profiles
CREATE TABLE IF NOT EXISTS public.adaptive_schedule_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    preferred_session_duration INTEGER DEFAULT 60, -- minutes
    optimal_study_windows JSONB DEFAULT '[]'::jsonb, -- learned best hours
    fatigue_threshold DOUBLE PRECISION DEFAULT 0.75,
    drift_sensitivity DOUBLE PRECISION DEFAULT 0.5,
    modality_preferences JSONB DEFAULT '{"video": 1.0, "text": 1.0, "quiz": 1.0}'::jsonb,
    cognitive_resilience_score DOUBLE PRECISION DEFAULT 0.5,
    recovery_efficiency DOUBLE PRECISION DEFAULT 0.5,
    circadian_profile TEXT CHECK (circadian_profile IN ('morning_lark', 'night_owl', 'intermediate')),
    last_recalculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Cognitive Window Performance (Historical Matrix)
CREATE TABLE IF NOT EXISTS public.cognitive_window_performance (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    hour_window INTEGER CHECK (hour_window BETWEEN 0 AND 23),
    specialty TEXT,
    retention_score DOUBLE PRECISION DEFAULT 0,
    stress_score DOUBLE PRECISION DEFAULT 0,
    fatigue_score DOUBLE PRECISION DEFAULT 0,
    replay_rate DOUBLE PRECISION DEFAULT 0,
    drift_rate DOUBLE PRECISION DEFAULT 0,
    tutor_dependency DOUBLE PRECISION DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, hour_window, specialty)
);

-- 3. Adaptive Schedule Simulations (Predictive)
CREATE TABLE IF NOT EXISTS public.adaptive_schedule_simulations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    predicted_retention DOUBLE PRECISION,
    predicted_overload DOUBLE PRECISION,
    predicted_fatigue DOUBLE PRECISION,
    predicted_drift DOUBLE PRECISION,
    recommended_sequence JSONB, -- [node_id, node_id, ...]
    estimated_mastery_gain DOUBLE PRECISION,
    simulation_confidence DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Adaptive Schedule Adjustments (Audit)
CREATE TABLE IF NOT EXISTS public.adaptive_schedule_adjustments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    previous_schedule JSONB,
    new_schedule JSONB,
    reason TEXT,
    trigger_type TEXT, -- 'fatigue_spike', 'circadian_optimization', 'retention_drop'
    cognitive_state JSONB, -- snapshot of stress/fatigue at trigger
    projected_gain DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adaptive_schedule_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_window_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_schedule_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_schedule_adjustments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own schedule profile" ON public.adaptive_schedule_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view window performance" ON public.cognitive_window_performance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view simulations" ON public.adaptive_schedule_simulations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view adjustments" ON public.adaptive_schedule_adjustments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all scheduler data" ON public.adaptive_schedule_profiles FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));
-- (Similar admin policies for the other tables)
CREATE POLICY "Admins view window perf" ON public.cognitive_window_performance FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));
CREATE POLICY "Admins view simulations" ON public.adaptive_schedule_simulations FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));
CREATE POLICY "Admins view adjustments" ON public.adaptive_schedule_adjustments FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Feature Flag
INSERT INTO public.system_flags (flag_key, enabled, description, category, rollout_mode)
VALUES ('adaptive_cognitive_scheduler_enabled', false, 'Habilita planejamento adaptativo longitudinal baseado em ritmos cognitivos.', 'adaptive', 'admins_only')
ON CONFLICT (flag_key) DO NOTHING;
