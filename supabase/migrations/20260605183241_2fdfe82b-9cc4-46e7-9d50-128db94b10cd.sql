-- Step 1: Institutional Infrastructure
CREATE TABLE IF NOT EXISTS public.institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'university', 'hospital', 'prep_course', 'extension_project'
    region TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.institution_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES public.institutions(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'enazizi_group', 'control_group'
    student_count INTEGER DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'archived'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 2: National Benchmark & Outcome Database
CREATE TABLE IF NOT EXISTS public.national_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment TEXT NOT NULL, -- 'beginner', 'intermediate', 'advanced', 'intern', 'graduate'
    avg_study_time_hours FLOAT,
    avg_readiness FLOAT,
    avg_official_score FLOAT,
    approval_rate FLOAT,
    sample_size INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enamed_outcome_database (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES auth.users(id),
    institution_id UUID REFERENCES public.institutions(id),
    official_score FLOAT,
    exam_year INTEGER,
    specialty_intended TEXT,
    status TEXT, -- 'approved', 'not_approved'
    is_anonymized BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 3: Effect Size & Science Engine
CREATE TABLE IF NOT EXISTS public.effect_size_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_a_id UUID REFERENCES public.institution_cohorts(id),
    cohort_b_id UUID REFERENCES public.institution_cohorts(id),
    cohens_d FLOAT,
    odds_ratio FLOAT,
    relative_gain FLOAT,
    absolute_gain FLOAT,
    p_value FLOAT,
    confidence_interval_low FLOAT,
    confidence_interval_high FLOAT,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scientific_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES public.institutions(id),
    type TEXT NOT NULL, -- 'white_paper', 'institutional', 'executive', 'investor'
    period TEXT NOT NULL, -- 'monthly', 'quarterly', 'annual'
    file_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 4: Governance & Validation Score
CREATE TABLE IF NOT EXISTS public.institutional_governance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL, -- 'sample_size', 'forecast_drift', 'outcome_divergence'
    current_value FLOAT,
    threshold FLOAT,
    status TEXT, -- 'healthy', 'warning', 'critical'
    last_check TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.institutions ADD COLUMN IF NOT EXISTS validation_score FLOAT DEFAULT 0;

-- Step 5: Grants & Security
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_cohorts TO authenticated;
GRANT SELECT ON public.national_benchmarks TO authenticated;
GRANT SELECT, INSERT ON public.enamed_outcome_database TO authenticated;
GRANT SELECT ON public.effect_size_metrics TO authenticated;
GRANT SELECT ON public.scientific_reports TO authenticated;
GRANT SELECT ON public.institutional_governance TO authenticated;

GRANT ALL ON public.institutions TO service_role;
GRANT ALL ON public.institution_cohorts TO service_role;
GRANT ALL ON public.national_benchmarks TO service_role;
GRANT ALL ON public.enamed_outcome_database TO service_role;
GRANT ALL ON public.effect_size_metrics TO service_role;
GRANT ALL ON public.scientific_reports TO service_role;
GRANT ALL ON public.institutional_governance TO service_role;

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.national_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enamed_outcome_database ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.effect_size_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scientific_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_governance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read institutions" ON public.institutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read cohorts" ON public.institution_cohorts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read benchmarks" ON public.national_benchmarks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own outcomes" ON public.enamed_outcome_database FOR ALL TO authenticated USING (auth.uid() = student_id);

-- Step 6: Telemetry Trigger (Simplified)
CREATE OR REPLACE FUNCTION public.log_institutional_event() RETURNS TRIGGER AS $$
BEGIN
    -- Assumes public.system_telemetry table exists from previous sprints
    INSERT INTO public.system_telemetry (event_type, metadata)
    VALUES (TG_ARGV[0], jsonb_build_object('id', NEW.id, 'timestamp', now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_institution_added AFTER INSERT ON public.institutions FOR EACH ROW EXECUTE FUNCTION public.log_institutional_event('INSTITUTION_ADDED');
CREATE TRIGGER tr_cohort_created AFTER INSERT ON public.institution_cohorts FOR EACH ROW EXECUTE FUNCTION public.log_institutional_event('COHORT_CREATED');
CREATE TRIGGER tr_outcome_confirmed AFTER INSERT ON public.enamed_outcome_database FOR EACH ROW EXECUTE FUNCTION public.log_institutional_event('OUTCOME_CONFIRMED');
CREATE TRIGGER tr_report_generated AFTER INSERT ON public.scientific_reports FOR EACH ROW EXECUTE FUNCTION public.log_institutional_event('SCIENTIFIC_REPORT_GENERATED');
