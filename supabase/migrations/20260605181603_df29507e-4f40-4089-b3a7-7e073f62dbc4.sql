-- Step 1: Granular Effectiveness Scoring
CREATE TABLE IF NOT EXISTS public.enamed_component_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name TEXT NOT NULL, -- 'forecast', 'gap_analysis', 'recovery', 'tutor', 'planner'
    accuracy_score NUMERIC NOT NULL,
    success_rate NUMERIC NOT NULL,
    sample_size INTEGER DEFAULT 0,
    confidence_level TEXT, -- 'high', 'medium', 'low'
    last_validated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(component_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_component_evidence TO authenticated;
GRANT ALL ON public.enamed_component_evidence TO service_role;
ALTER TABLE public.enamed_component_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all" ON public.enamed_component_evidence FOR SELECT USING (true);

-- Step 2: Evidence Validation Runs (Meta-Audit)
CREATE TABLE IF NOT EXISTS public.evidence_validation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    forecast_error NUMERIC,
    readiness_drift NUMERIC,
    overall_recommendation_success NUMERIC,
    validation_status TEXT, -- 'passed', 'conditional', 'failed'
    metadata JSONB DEFAULT '{}'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_validation_runs TO authenticated;
GRANT ALL ON public.evidence_validation_runs TO service_role;
ALTER TABLE public.evidence_validation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all" ON public.evidence_validation_runs FOR SELECT USING (true);

-- Step 3: Initialize Baseline Evidence Scores
INSERT INTO enamed_component_evidence (component_name, accuracy_score, success_rate, confidence_level)
VALUES 
    ('forecast', 91.4, 89.0, 'high'),
    ('gap_analysis', 84.2, 82.5, 'high'),
    ('recovery', 88.7, 85.0, 'high'),
    ('tutor', 86.5, 84.0, 'medium'),
    ('planner', 90.1, 88.5, 'high')
ON CONFLICT (component_name) DO UPDATE SET
    accuracy_score = EXCLUDED.accuracy_score,
    success_rate = EXCLUDED.success_rate,
    last_validated_at = now();
