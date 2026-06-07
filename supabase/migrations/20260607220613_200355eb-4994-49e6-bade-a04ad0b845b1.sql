-- FASE 1: Ranking Top 100 User Requests
CREATE TABLE IF NOT EXISTS public.ugrp_top_100_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT NOT NULL UNIQUE,
    frequency INTEGER DEFAULT 0,
    success_rate NUMERIC(5,2) DEFAULT 0.00,
    insufficient_bank_rate NUMERIC(5,2) DEFAULT 0.00,
    leakage_detected BOOLEAN DEFAULT FALSE,
    last_audit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL ON public.ugrp_top_100_requests TO authenticated, service_role;

-- FASE 2 & 7: Real Generation Tests & Coverage Sufficiency
CREATE TABLE IF NOT EXISTS public.ugrp_generation_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT NOT NULL,
    requested_size INTEGER NOT NULL,
    status TEXT NOT NULL, -- SUCCESS, FAILURE, INSUFFICIENT_BANK
    found_count INTEGER DEFAULT 0,
    leakage_score NUMERIC(5,2) DEFAULT 0.00,
    tested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL ON public.ugrp_generation_tests TO authenticated, service_role;

-- FASE 3: End-to-End Trace
CREATE TABLE IF NOT EXISTS public.ugrp_e2e_trace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_term TEXT,
    alias_resolved TEXT,
    competency_id TEXT,
    questions_found INTEGER,
    response_returned JSONB,
    trace_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL ON public.ugrp_e2e_trace TO authenticated, service_role;

-- FASE 4 & 11: Root Cause & Remediation
CREATE TABLE IF NOT EXISTS public.ugrp_remediation_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT UNIQUE,
    root_cause_code CHAR(1), -- A, B, C, D, E, F, G
    root_cause_desc TEXT,
    corrective_action TEXT,
    priority TEXT DEFAULT 'P0',
    status TEXT DEFAULT 'OPEN',
    estimated_recovery_at TIMESTAMP WITH TIME ZONE
);

GRANT ALL ON public.ugrp_remediation_plan TO authenticated, service_role;

-- FASE 5: Topic Leakage Audit
CREATE TABLE IF NOT EXISTS public.ugrp_leakage_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_competency TEXT,
    target_competency TEXT,
    leakage_count INTEGER,
    integrity_score NUMERIC(5,2),
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

GRANT ALL ON public.ugrp_leakage_audit TO authenticated, service_role;

-- FASE 9: User Impact Score (UIS) Update
ALTER TABLE public.cvrp_user_requests_impact ADD COLUMN IF NOT EXISTS uis_score NUMERIC(5,2);
ALTER TABLE public.cvrp_user_requests_impact ADD COLUMN IF NOT EXISTS topic_success_rate NUMERIC(5,2);
ALTER TABLE public.cvrp_user_requests_impact ADD COLUMN IF NOT EXISTS coverage_sufficiency NUMERIC(5,2);
ALTER TABLE public.cvrp_user_requests_impact ADD COLUMN IF NOT EXISTS alias_resolution_rate NUMERIC(5,2);
ALTER TABLE public.cvrp_user_requests_impact ADD COLUMN IF NOT EXISTS topic_integrity NUMERIC(5,2);

-- Populate Top 20 Critical Competencies (FASE 10)
CREATE TABLE IF NOT EXISTS public.ugrp_critical_competencies (
    name TEXT PRIMARY KEY,
    status TEXT DEFAULT 'PENDING',
    last_validation_at TIMESTAMP WITH TIME ZONE
);

GRANT ALL ON public.ugrp_critical_competencies TO authenticated, service_role;

INSERT INTO public.ugrp_critical_competencies (name) VALUES 
('IAM com Supra'), ('IAM sem Supra'), ('Sepse'), ('AVC'), ('CAD'), 
('TEP'), ('Hipercalemia'), ('Pneumonia Grave'), ('Insuficiência Cardíaca'), 
('IRA'), ('DKA'), ('Eclâmpsia'), ('Pré-eclâmpsia'), ('HPP'), 
('Trauma'), ('Apendicite'), ('Abdome Agudo'), ('Bronquiolite'), 
('Asma Grave'), ('Sepse Neonatal')
ON CONFLICT DO NOTHING;

-- Function to calculate UIS
CREATE OR REPLACE FUNCTION public.calculate_ugrp_uis()
RETURNS TRIGGER AS $$
BEGIN
    NEW.uis_score := (
        (COALESCE(NEW.topic_success_rate, 0) * 0.40) +
        (COALESCE(NEW.coverage_sufficiency, 0) * 0.20) +
        (COALESCE(NEW.alias_resolution_rate, 0) * 0.15) +
        (0.15 * 100) + -- End-to-End Success placeholder
        (COALESCE(NEW.topic_integrity, 0) * 0.10)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ugrp_uis
BEFORE INSERT OR UPDATE ON public.cvrp_user_requests_impact
FOR EACH ROW EXECUTE FUNCTION public.calculate_ugrp_uis();

-- Enable RLS
ALTER TABLE public.ugrp_top_100_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugrp_generation_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugrp_e2e_trace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugrp_remediation_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugrp_leakage_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugrp_critical_competencies ENABLE ROW LEVEL SECURITY;

-- Basic Read Policies
CREATE POLICY "Public read top requests" ON public.ugrp_top_100_requests FOR SELECT USING (true);
CREATE POLICY "Public read generation tests" ON public.ugrp_generation_tests FOR SELECT USING (true);
CREATE POLICY "Public read e2e trace" ON public.ugrp_e2e_trace FOR SELECT USING (true);
CREATE POLICY "Public read remediation plan" ON public.ugrp_remediation_plan FOR SELECT USING (true);
CREATE POLICY "Public read leakage audit" ON public.ugrp_leakage_audit FOR SELECT USING (true);
CREATE POLICY "Public read critical competencies" ON public.ugrp_critical_competencies FOR SELECT USING (true);
