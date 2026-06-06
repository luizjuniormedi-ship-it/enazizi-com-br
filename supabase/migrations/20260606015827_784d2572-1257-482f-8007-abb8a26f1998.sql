-- Publication Dataset Engine
CREATE TABLE IF NOT EXISTS public.publication_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_name TEXT NOT NULL,
    cohort_tag TEXT NOT NULL,
    sample_size INTEGER NOT NULL,
    forecast_accuracy NUMERIC NOT NULL,
    approval_rate NUMERIC NOT NULL,
    readiness_correlation NUMERIC NOT NULL,
    effect_size NUMERIC NOT NULL,
    confidence_interval NUMERIC NOT NULL,
    evidence_score NUMERIC NOT NULL,
    validation_tier TEXT NOT NULL DEFAULT 'C', -- A, B, C
    dataset_payload JSONB DEFAULT '{}', -- Raw anonymized data snapshot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Scientific Reports & Investor Packs
CREATE TABLE IF NOT EXISTS public.scientific_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT NOT NULL, -- 'scientific', 'executive', 'investor'
    title TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id),
    status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
    metrics_snapshot JSONB NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Institutional Dashboard Metrics
CREATE TABLE IF NOT EXISTS public.institutional_dashboard_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id TEXT NOT NULL, -- Logical ID for Uni/Hospital
    institution_name TEXT NOT NULL,
    total_students INTEGER DEFAULT 0,
    avg_readiness NUMERIC DEFAULT 0,
    forecast_accuracy NUMERIC DEFAULT 0,
    approval_rate NUMERIC DEFAULT 0,
    tutor_impact_score NUMERIC DEFAULT 0,
    fsrs_impact_score NUMERIC DEFAULT 0,
    evidence_health_score NUMERIC DEFAULT 0,
    last_refresh TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(institution_id)
);

-- Causality Confidence Engine Logs
CREATE TABLE IF NOT EXISTS public.causality_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL,
    matching_method TEXT DEFAULT 'propensity_score',
    causality_tier TEXT NOT NULL, -- 'Observed Trend', 'Strong Correlation', 'Probable Causality', 'Validated Impact'
    confidence_score NUMERIC NOT NULL, -- 0-1
    longitudinal_stability NUMERIC,
    effect_size_d NUMERIC,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_datasets TO authenticated;
GRANT ALL ON public.publication_datasets TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scientific_reports TO authenticated;
GRANT ALL ON public.scientific_reports TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutional_dashboard_metrics TO authenticated;
GRANT ALL ON public.institutional_dashboard_metrics TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.causality_analysis_logs TO authenticated;
GRANT ALL ON public.causality_analysis_logs TO service_role;

-- RLS
ALTER TABLE public.publication_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scientific_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_dashboard_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.causality_analysis_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view publication datasets" ON public.publication_datasets FOR SELECT USING (true);
CREATE POLICY "Anyone authenticated can view institutional metrics" ON public.institutional_dashboard_metrics FOR SELECT USING (true);
CREATE POLICY "Admins can manage reports" ON public.scientific_reports FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
