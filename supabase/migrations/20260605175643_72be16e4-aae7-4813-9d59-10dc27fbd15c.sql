-- Step 1: Create enamed_impact_scores table
CREATE TABLE IF NOT EXISTS public.enamed_impact_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES public.curriculum_matrix(id) ON DELETE CASCADE,
    frequency_score NUMERIC DEFAULT 0,
    approval_impact_score NUMERIC DEFAULT 0,
    difficulty_score NUMERIC DEFAULT 0,
    mastery_threshold NUMERIC DEFAULT 70,
    historical_occurrences INTEGER DEFAULT 0,
    last_occurrence_year INTEGER,
    global_priority NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(theme_id)
);

-- Step 2: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_impact_scores TO authenticated;
GRANT ALL ON public.enamed_impact_scores TO service_role;

-- Step 3: Enable RLS
ALTER TABLE public.enamed_impact_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.enamed_impact_scores FOR SELECT USING (true);

-- Step 4: Create Readiness Gap Engine Function
CREATE OR REPLACE FUNCTION public.calculate_readiness_gap(p_user_id UUID)
RETURNS TABLE (
    theme_id UUID,
    theme_name TEXT,
    current_mastery NUMERIC,
    potential_gain NUMERIC,
    priority NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id as theme_id,
        cm.tema as theme_name,
        COALESCE(smm.theoretical_score * 100, 0)::NUMERIC as current_mastery,
        (eis.approval_impact_score * (1 - COALESCE(smm.theoretical_score, 0)))::NUMERIC as potential_gain,
        eis.global_priority as priority
    FROM curriculum_matrix cm
    JOIN enamed_impact_scores eis ON cm.id = eis.theme_id
    LEFT JOIN student_mastery_metrics smm ON cm.id = smm.node_id AND smm.user_id = p_user_id
    WHERE cm.ativo = true
    ORDER BY potential_gain DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.calculate_readiness_gap TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_readiness_gap TO service_role;

-- Step 5: Update study_performance or create a table for forecasts
CREATE TABLE IF NOT EXISTS public.enamed_approval_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    current_probability NUMERIC,
    forecast_30_days NUMERIC,
    forecast_60_days NUMERIC,
    forecast_exam_date NUMERIC,
    readiness_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_approval_forecasts TO authenticated;
GRANT ALL ON public.enamed_approval_forecasts TO service_role;
ALTER TABLE public.enamed_approval_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own forecasts" ON public.enamed_approval_forecasts FOR ALL USING (auth.uid() = user_id);
