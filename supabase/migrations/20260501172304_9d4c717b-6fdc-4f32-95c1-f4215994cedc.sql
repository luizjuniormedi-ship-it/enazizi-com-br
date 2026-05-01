-- Longitudinal Cognitive Patterns
CREATE TABLE IF NOT EXISTS public.cognitive_rhythm_snapshots (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    hour_of_day INTEGER CHECK (hour_of_day BETWEEN 0 AND 23),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    avg_stress_index DOUBLE PRECISION,
    avg_accuracy DOUBLE PRECISION,
    avg_fatigue_index DOUBLE PRECISION,
    retention_efficiency DOUBLE PRECISION, -- accuracy / load
    sample_size INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, hour_of_day, day_of_week)
);

-- Long-term profile expansion
ALTER TABLE public.adaptive_student_profiles 
ADD COLUMN IF NOT EXISTS longitudinal_patterns JSONB DEFAULT '{}'::jsonb, -- {optimal_hours: [], fatigue_threshold_min: 75}
ADD COLUMN IF NOT EXISTS drift_score DOUBLE PRECISION DEFAULT 0, -- 0-1, detection of focus loss
ADD COLUMN IF NOT EXISTS circadian_intelligence_active BOOLEAN DEFAULT true;

-- Cognitive Drift Detection
CREATE TABLE IF NOT EXISTS public.cognitive_drift_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    drift_type TEXT NOT NULL, -- 'focus_loss', 'false_mastery', 'saturation'
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    severity DOUBLE PRECISION,
    evidence JSONB, -- snapshots of metrics that triggered the drift
    mitigation_action TEXT -- 'session_termination', 'intensity_reduction'
);

-- Enable RLS
ALTER TABLE public.cognitive_rhythm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_drift_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Students can view their own rhythm" 
ON public.cognitive_rhythm_snapshots FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view rhythm data" 
ON public.cognitive_rhythm_snapshots FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Procedure to aggregate rhythm (Mock/Draft Logic)
CREATE OR REPLACE FUNCTION public.sync_cognitive_rhythm(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.cognitive_rhythm_snapshots (user_id, hour_of_day, day_of_week, avg_stress_index, avg_accuracy, avg_fatigue_index, sample_size)
    SELECT 
        user_id,
        EXTRACT(HOUR FROM created_at) as hr,
        EXTRACT(DOW FROM created_at) as dw,
        AVG(stress_index),
        AVG(1.0 - friction_index), -- Proxy for accuracy
        AVG(load_index),
        COUNT(*)
    FROM public.cognitive_state_history
    WHERE user_id = p_user_id
    GROUP BY user_id, hr, dw
    ON CONFLICT (user_id, hour_of_day, day_of_week) DO UPDATE SET
        avg_stress_index = EXCLUDED.avg_stress_index,
        avg_accuracy = EXCLUDED.avg_accuracy,
        avg_fatigue_index = EXCLUDED.avg_fatigue_index,
        sample_size = EXCLUDED.sample_size,
        updated_at = now();
END;
$$ LANGUAGE plpgsql;
