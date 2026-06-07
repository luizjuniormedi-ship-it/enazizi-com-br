-- FASE 1 & 12: COMPETENCY DEEP DIVE & DASHBOARD
CREATE TABLE IF NOT EXISTS public.ugrp_competency_audit (
    competency TEXT PRIMARY KEY,
    uis NUMERIC DEFAULT 0,
    physical_questions INTEGER DEFAULT 0,
    mapped_questions INTEGER DEFAULT 0,
    visible_questions INTEGER DEFAULT 0,
    selectable_questions INTEGER DEFAULT 0,
    max_capacity INTEGER DEFAULT 0,
    alias_resolution_rate NUMERIC DEFAULT 0,
    topic_success_rate NUMERIC DEFAULT 0,
    topic_leakage_rate NUMERIC DEFAULT 0,
    duplicate_pressure_rate NUMERIC DEFAULT 0,
    last_audit_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ugrp_competency_audit TO authenticated;
GRANT ALL ON public.ugrp_competency_audit TO service_role;
ALTER TABLE public.ugrp_competency_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for audit" ON public.ugrp_competency_audit FOR SELECT USING (true);

-- FASE 4: QUESTION ATTRITION MAP
CREATE TABLE IF NOT EXISTS public.ugrp_question_attrition_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency TEXT REFERENCES public.ugrp_competency_audit(competency),
    stage TEXT, -- 'physical', 'classified', 'valid', 'unique', 'eligible', 'returnable'
    count INTEGER,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.ugrp_question_attrition_map TO authenticated;
GRANT ALL ON public.ugrp_question_attrition_map TO service_role;
ALTER TABLE public.ugrp_question_attrition_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for attrition" ON public.ugrp_question_attrition_map FOR SELECT USING (true);

-- FASE 5: ALIAS EXPANSION AUDIT
CREATE TABLE IF NOT EXISTS public.ugrp_alias_resolution_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_term TEXT,
    resolved_competency TEXT REFERENCES public.ugrp_competency_audit(competency),
    is_success BOOLEAN DEFAULT false,
    resolution_time_ms INTEGER,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.ugrp_alias_resolution_audit TO authenticated;
GRANT ALL ON public.ugrp_alias_resolution_audit TO service_role;
ALTER TABLE public.ugrp_alias_resolution_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for aliases" ON public.ugrp_alias_resolution_audit FOR SELECT USING (true);

-- FASE 10: END-TO-END FAILURE TRACE
CREATE TABLE IF NOT EXISTS public.ugrp_simulado_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_term TEXT,
    alias_used TEXT,
    competency TEXT,
    requested_count INTEGER,
    returned_count INTEGER,
    frontend_status TEXT,
    error_details TEXT,
    trace_id TEXT,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.ugrp_simulado_generation_logs TO authenticated;
GRANT ALL ON public.ugrp_simulado_generation_logs TO service_role;
ALTER TABLE public.ugrp_simulado_generation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for logs" ON public.ugrp_simulado_generation_logs FOR SELECT USING (true);

-- FASE 11: AUTOMATED RECOVERY ENGINE
CREATE TABLE IF NOT EXISTS public.ugrp_recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency TEXT,
    root_cause TEXT,
    fix_action TEXT,
    priority TEXT, -- 'P0', 'P1', 'P2'
    impact_estimate NUMERIC,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ugrp_recovery_actions TO authenticated;
GRANT ALL ON public.ugrp_recovery_actions TO service_role;
ALTER TABLE public.ugrp_recovery_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for recovery" ON public.ugrp_recovery_actions FOR SELECT USING (true);

-- INITIAL SEED FOR WAR ROOM (FASE 13)
INSERT INTO public.ugrp_competency_audit (competency, uis, physical_questions)
VALUES 
('IAM com Supra', 60.44, 450),
('IAM sem Supra', 58.20, 380),
('Sepse', 62.19, 520),
('AVC', 55.00, 310),
('CAD', 45.30, 180),
('TEP', 48.00, 220),
('Hipercalemia', 40.00, 95),
('Pneumonia Grave', 35.00, 140),
('IC', 50.00, 280)
ON CONFLICT (competency) DO UPDATE SET physical_questions = EXCLUDED.physical_questions;

-- VIEW FOR REAL-TIME UIS MONITORING (FASE 2)
CREATE OR REPLACE VIEW public.ugrp_uis_dashboard AS
SELECT 
    competency,
    uis,
    alias_resolution_rate,
    topic_success_rate,
    (selectable_questions::float / NULLIF(physical_questions, 0)) * 100 as coverage_score,
    max_capacity,
    last_audit_at
FROM public.ugrp_competency_audit;
