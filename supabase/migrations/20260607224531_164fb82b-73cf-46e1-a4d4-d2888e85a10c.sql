-- Phase 1: Curriculum Inventory
CREATE TABLE public.fccp_curriculum_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialty TEXT NOT NULL,
    theme TEXT NOT NULL,
    subtheme TEXT,
    competency TEXT NOT NULL,
    competency_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 2 & 3: Competency Coverage Audit & Minimum Operational Coverage
CREATE TABLE public.fccp_competency_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT REFERENCES public.fccp_curriculum_inventory(competency_id),
    physical_count INTEGER DEFAULT 0,
    mapped_count INTEGER DEFAULT 0,
    published_count INTEGER DEFAULT 0,
    unique_count INTEGER DEFAULT 0,
    eligible_count INTEGER DEFAULT 0,
    gold_count INTEGER DEFAULT 0,
    gold_verified_count INTEGER DEFAULT 0,
    coverage_status TEXT, -- CRITICAL, LIMITED, OPERACIONAL, ROBUSTO, PREMIUM
    uis_score NUMERIC DEFAULT 0,
    topic_success_rate NUMERIC DEFAULT 0,
    last_audit_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 4: Gap Detection
CREATE TABLE public.fccp_coverage_gap_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT REFERENCES public.fccp_curriculum_inventory(competency_id),
    gap_severity TEXT, -- CRITICAL, HIGH, MEDIUM
    priority_rank INTEGER,
    remediation_status TEXT DEFAULT 'PENDING',
    source_priority TEXT, -- ENARE, ENAMED, Hospital Virtual
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 7: Specialty Certification
CREATE TABLE public.fccp_specialty_certification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialty TEXT UNIQUE NOT NULL,
    competencies_count INTEGER,
    certified_count INTEGER,
    is_certified BOOLEAN DEFAULT false,
    certified_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 8: User Impact Validation
CREATE TABLE public.fccp_user_impact_validation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT REFERENCES public.fccp_curriculum_inventory(competency_id),
    test_run_id UUID,
    questions_requested INTEGER,
    questions_returned INTEGER,
    uis_result NUMERIC,
    success BOOLEAN,
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 11: Learning Coverage
CREATE TABLE public.fccp_learning_coverage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT REFERENCES public.fccp_curriculum_inventory(competency_id),
    tutor_v3_ready BOOLEAN DEFAULT false,
    recovery_mode_ready BOOLEAN DEFAULT false,
    fsrs_ready BOOLEAN DEFAULT false,
    hospital_virtual_ready BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 13: Curriculum Completeness Score (CCS)
CREATE OR REPLACE VIEW public.v_fccp_curriculum_completeness_score AS
WITH competency_metrics AS (
    SELECT 
        a.competency_id,
        CASE WHEN a.eligible_count >= 50 THEN 100 ELSE (a.eligible_count::numeric / 50 * 100) END as coverage_score,
        CASE WHEN a.eligible_count >= 50 THEN 100 ELSE (a.eligible_count::numeric / 50 * 100) END as eligibility_score,
        a.uis_score as uis_score,
        a.topic_success_rate as topic_success_score,
        CASE WHEN a.gold_count > 0 THEN 100 ELSE 0 END as quality_score,
        CASE WHEN a.unique_count = a.physical_count THEN 100 ELSE (a.unique_count::numeric / GREATEST(a.physical_count, 1) * 100) END as duplication_score
    FROM public.fccp_competency_audit a
)
SELECT 
    AVG(coverage_score) * 0.30 +
    AVG(eligibility_score) * 0.20 +
    AVG(uis_score) * 0.15 +
    AVG(topic_success_score) * 0.15 +
    AVG(quality_score) * 0.10 +
    AVG(duplication_score) * 0.10 as ccs_score,
    COUNT(*) as total_competencies
FROM competency_metrics;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON public.v_fccp_curriculum_completeness_score TO authenticated;
GRANT SELECT ON public.v_fccp_curriculum_completeness_score TO service_role;

-- Enable RLS
ALTER TABLE public.fccp_curriculum_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fccp_competency_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fccp_coverage_gap_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fccp_specialty_certification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fccp_user_impact_validation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fccp_learning_coverage ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies (allow all for authenticated for now as requested by previous patterns)
CREATE POLICY "Allow all for authenticated on inventory" ON public.fccp_curriculum_inventory FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated on audit" ON public.fccp_competency_audit FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated on gaps" ON public.fccp_coverage_gap_registry FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated on certification" ON public.fccp_specialty_certification FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated on validation" ON public.fccp_user_impact_validation FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated on learning" ON public.fccp_learning_coverage FOR ALL USING (true);
