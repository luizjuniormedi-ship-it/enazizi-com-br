-- Step 1: Forecast Calibration
CREATE TABLE IF NOT EXISTS public.enamed_forecast_calibration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    forecast_score NUMERIC NOT NULL,
    actual_score NUMERIC,
    forecast_error NUMERIC,
    confidence_interval NUMERIC,
    calibration_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_forecast_calibration TO authenticated;
GRANT ALL ON public.enamed_forecast_calibration TO service_role;
ALTER TABLE public.enamed_forecast_calibration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own calibration data" ON public.enamed_forecast_calibration FOR ALL USING (auth.uid() = user_id);

-- Step 2: Readiness Drift Monitoring
CREATE TABLE IF NOT EXISTS public.readiness_drift_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    old_score NUMERIC,
    new_score NUMERIC,
    drift_type TEXT, -- 'inflation', 'underestimated', 'stable', 'inconsistent'
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.readiness_drift_logs TO authenticated;
GRANT ALL ON public.readiness_drift_logs TO service_role;
ALTER TABLE public.readiness_drift_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own drift logs" ON public.readiness_drift_logs FOR ALL USING (auth.uid() = user_id);

-- Step 3: Recommendation Effectiveness
CREATE TABLE IF NOT EXISTS public.enamed_recommendation_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES public.curriculum_matrix(id),
    recommendation_type TEXT,
    status TEXT DEFAULT 'recommended', -- 'accepted', 'completed', 'success'
    readiness_before NUMERIC,
    readiness_after NUMERIC,
    performance_gain NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_recommendation_tracking TO authenticated;
GRANT ALL ON public.enamed_recommendation_tracking TO service_role;
ALTER TABLE public.enamed_recommendation_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own recommendation tracking" ON public.enamed_recommendation_tracking FOR ALL USING (auth.uid() = user_id);

-- Step 4: Add function to detect drift
CREATE OR REPLACE FUNCTION public.detect_readiness_drift(
    p_user_id UUID,
    p_new_score NUMERIC
) RETURNS TEXT AS $$
DECLARE
    v_old_score NUMERIC;
    v_drift TEXT := 'stable';
BEGIN
    SELECT readiness_score INTO v_old_score 
    FROM enamed_approval_forecasts 
    WHERE user_id = p_user_id;

    IF v_old_score IS NULL THEN
        RETURN 'stable';
    END IF;

    IF (p_new_score - v_old_score) > 15 THEN
        v_drift := 'inflation';
    ELSIF (v_old_score - p_new_score) > 15 THEN
        v_drift := 'underestimated';
    END IF;

    IF v_drift != 'stable' THEN
        INSERT INTO readiness_drift_logs (user_id, old_score, new_score, drift_type)
        VALUES (p_user_id, v_old_score, p_new_score, v_drift);
    END IF;

    RETURN v_drift;
END;
$$ LANGUAGE plpgsql;
