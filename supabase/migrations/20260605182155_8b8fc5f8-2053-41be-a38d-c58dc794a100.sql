-- Step 1: Official Exam Results Tracking
CREATE TABLE IF NOT EXISTS public.official_exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_name TEXT NOT NULL, -- 'ENAMED', 'ENARE', 'USP', etc.
    exam_year INTEGER NOT NULL,
    official_grade NUMERIC NOT NULL,
    max_grade NUMERIC DEFAULT 100,
    approval_status TEXT, -- 'approved', 'waitlist', 'not_approved'
    specialty_choice TEXT,
    institution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, exam_name, exam_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_exam_results TO authenticated;
GRANT ALL ON public.official_exam_results TO service_role;
ALTER TABLE public.official_exam_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own exam results" ON public.official_exam_results FOR ALL USING (auth.uid() = user_id);

-- Step 2: Outcome Correlation Study (Internal vs External)
CREATE TABLE IF NOT EXISTS public.outcome_correlation_study (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_result_id UUID REFERENCES public.official_exam_results(id),
    initial_readiness NUMERIC,
    final_readiness NUMERIC,
    forecasted_grade NUMERIC,
    actual_grade NUMERIC,
    total_study_hours INTEGER,
    questions_answered INTEGER,
    accuracy_rate NUMERIC,
    gain_observed NUMERIC,
    correlation_error NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outcome_correlation_study TO authenticated;
GRANT ALL ON public.outcome_correlation_study TO service_role;
ALTER TABLE public.outcome_correlation_study ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for researchers" ON public.outcome_correlation_study FOR SELECT USING (true);

-- Step 3: Global Outcome Aggregates
CREATE TABLE IF NOT EXISTS public.global_outcome_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_name TEXT NOT NULL, -- 'ENAMED_2026_EARLY', 'ENARE_2025'
    sample_size INTEGER DEFAULT 0,
    avg_gain NUMERIC,
    avg_forecast_accuracy NUMERIC,
    approval_rate NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(cohort_name)
);

GRANT SELECT ON public.global_outcome_stats TO authenticated;
GRANT ALL ON public.global_outcome_stats TO service_role;
ALTER TABLE public.global_outcome_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public global outcomes" ON public.global_outcome_stats FOR SELECT USING (true);
