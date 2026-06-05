-- Step 1: Study Cohorts
CREATE TABLE IF NOT EXISTS public.longitudinal_study_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'ENAMED_2026_ALPHA', 'ENARE_PREMIUM_2025'
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    target_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    total_participants INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.longitudinal_study_cohorts TO authenticated;
GRANT ALL ON public.longitudinal_study_cohorts TO service_role;
ALTER TABLE public.longitudinal_study_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public cohort view" ON public.longitudinal_study_cohorts FOR SELECT USING (true);

-- Step 2: Performance Attribution
CREATE TABLE IF NOT EXISTS public.mechanism_attribution_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mechanism_name TEXT NOT NULL, -- 'tutor_v3', 'planner', 'recovery', 'fsrs', 'simulados'
    attribution_weight NUMERIC NOT NULL, -- Contribution to total gain
    confidence_score NUMERIC,
    validated_gain NUMERIC,
    last_recalculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, mechanism_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mechanism_attribution_scores TO authenticated;
GRANT ALL ON public.mechanism_attribution_scores TO service_role;
ALTER TABLE public.mechanism_attribution_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their attribution" ON public.mechanism_attribution_scores FOR SELECT USING (auth.uid() = user_id);

-- Step 3: Scientific Publication Logs
CREATE TABLE IF NOT EXISTS public.scientific_report_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT NOT NULL, -- 'quarterly', 'annual', 'scientific', 'investor'
    cohort_id UUID REFERENCES public.longitudinal_study_cohorts(id),
    title TEXT NOT NULL,
    summary_json JSONB NOT NULL,
    file_url TEXT,
    generated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scientific_report_logs TO authenticated;
GRANT ALL ON public.scientific_report_logs TO service_role;
ALTER TABLE public.scientific_report_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated" ON public.scientific_report_logs FOR SELECT USING (auth.role() = 'authenticated');

-- Step 4: Initialize Alpha Cohort
INSERT INTO longitudinal_study_cohorts (name, description, target_date)
VALUES ('ALPHA_2026', 'Primeira coorte oficial de validação ENAMED 2026', '2026-12-31')
ON CONFLICT (name) DO NOTHING;

-- Step 5: Update Official Exam Results with Cohort ID
ALTER TABLE official_exam_results ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES longitudinal_study_cohorts(id);
