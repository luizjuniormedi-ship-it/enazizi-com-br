-- Outcome Correlation Metrics
CREATE TABLE IF NOT EXISTS public.outcome_correlation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    readiness_final DOUBLE PRECISION DEFAULT 0,
    forecast_final DOUBLE PRECISION DEFAULT 0,
    yield_final DOUBLE PRECISION DEFAULT 0,
    transfer_score DOUBLE PRECISION DEFAULT 0,
    real_exam_score DOUBLE PRECISION,
    approved BOOLEAN DEFAULT false,
    exam_name TEXT,
    correlation_batch TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Feature Attribution Scores (Impact of each module)
CREATE TABLE IF NOT EXISTS public.feature_attribution_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL, -- 'tutor', 'fsrs', 'planner', 'recovery', 'simulados', 'flashcards'
    impact_weight DOUBLE PRECISION NOT NULL, -- 0.0 to 1.0
    confidence_level DOUBLE PRECISION DEFAULT 0.95,
    sample_size INTEGER DEFAULT 0,
    calculation_method TEXT DEFAULT 'regression',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Academic Cohorts for Science Validation
CREATE TABLE IF NOT EXISTS public.academic_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'ALPHA_2026', 'ENARE_2026', etc.
    description TEXT,
    target_exam TEXT,
    start_date DATE,
    end_date DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_cohort_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES public.academic_cohorts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(cohort_id, user_id)
);

-- Permissions
GRANT SELECT ON public.outcome_correlation_metrics TO authenticated;
GRANT ALL ON public.outcome_correlation_metrics TO service_role;

GRANT SELECT ON public.feature_attribution_scores TO authenticated;
GRANT ALL ON public.feature_attribution_scores TO service_role;

GRANT SELECT ON public.academic_cohorts TO authenticated;
GRANT ALL ON public.academic_cohorts TO service_role;

GRANT SELECT ON public.academic_cohort_members TO authenticated;
GRANT ALL ON public.academic_cohort_members TO service_role;

-- RLS
ALTER TABLE public.outcome_correlation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_attribution_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_cohort_members ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own outcome metrics" 
ON public.outcome_correlation_metrics FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all outcome science data" 
ON public.outcome_correlation_metrics FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'professor')
    )
);

CREATE POLICY "Everyone can view feature attribution" 
ON public.feature_attribution_scores FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can manage feature attribution" 
ON public.feature_attribution_scores FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Users can view cohort info" 
ON public.academic_cohorts FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins can manage cohorts" 
ON public.academic_cohorts FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Users can view their own cohort membership" 
ON public.academic_cohort_members FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage cohort members" 
ON public.academic_cohort_members FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'professor')
    )
);
