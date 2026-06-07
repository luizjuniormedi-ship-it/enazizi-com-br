
-- 1. Extend curriculum_topics with required FCCP metrics
ALTER TABLE public.curriculum_topics 
ADD COLUMN IF NOT EXISTS rvs_score NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS recovery_priority TEXT CHECK (recovery_priority IN ('STRATEGIC_CRITICAL', 'HIGH_PRIORITY', 'NORMAL_PRIORITY', 'LOW_PRIORITY')),
ADD COLUMN IF NOT EXISTS rvp_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS visible_questions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS recoverable_questions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rps NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'critical';

-- 2. Create Recovery Audit Log for Governance (Phase 11)
CREATE TABLE IF NOT EXISTS public.fccp_recovery_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id),
    recovery_source TEXT,
    rvs_score_at_recovery NUMERIC(5,2),
    quality_score NUMERIC(5,2),
    questions_recovered INTEGER,
    ccs_gain NUMERIC(5,2),
    auditor_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.fccp_recovery_audit_log TO authenticated;
GRANT ALL ON public.fccp_recovery_audit_log TO service_role;
ALTER TABLE public.fccp_recovery_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auditors can manage logs" ON public.fccp_recovery_audit_log FOR ALL USING (auth.uid() IS NOT NULL);

-- 3. Function to calculate RVS Score (Phase 1)
CREATE OR REPLACE FUNCTION public.calculate_rvs_score(topic_id UUID) 
RETURNS NUMERIC AS $$
DECLARE
    score NUMERIC := 0;
    meta JSONB;
BEGIN
    SELECT rvp_metadata FROM public.curriculum_topics WHERE id = topic_id INTO meta;
    
    -- Weights from Phase 1
    score := score + (COALESCE((meta->>'enare_incidence')::NUMERIC, 0) * 0.25);
    score := score + (COALESCE((meta->>'enamed_incidence')::NUMERIC, 0) * 0.20);
    score := score + (COALESCE((meta->>'search_frequency')::NUMERIC, 0) * 0.15);
    score := score + (COALESCE((meta->>'tutor_v3_potential')::NUMERIC, 0) * 0.15);
    score := score + (COALESCE((meta->>'recovery_mode_potential')::NUMERIC, 0) * 0.10);
    score := score + (COALESCE((meta->>'hospital_virtual_potential')::NUMERIC, 0) * 0.05);
    score := score + (COALESCE((meta->>'fsrs_impact')::NUMERIC, 0) * 0.05);
    score := score + (COALESCE((meta->>'simulado_potential')::NUMERIC, 0) * 0.05);
    
    RETURN LEAST(GREATEST(score, 0), 100);
END;
$$ LANGUAGE plpgsql;

-- 4. Function to classify Priority (Phase 3)
CREATE OR REPLACE FUNCTION public.classify_recovery_priority(rvs_score NUMERIC) 
RETURNS TEXT AS $$
BEGIN
    IF rvs_score >= 90 THEN RETURN 'STRATEGIC_CRITICAL';
    ELSIF rvs_score >= 70 THEN RETURN 'HIGH_PRIORITY';
    ELSIF rvs_score >= 50 THEN RETURN 'NORMAL_PRIORITY';
    ELSE RETURN 'LOW_PRIORITY';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Initialize RVS Data with some sample weights for critical areas
UPDATE public.curriculum_topics
SET rvp_metadata = jsonb_build_object(
    'enare_incidence', CASE 
        WHEN nome ILIKE '%SUS%' OR nome ILIKE '%Saúde Coletiva%' THEN 95 
        WHEN nome ILIKE '%Trauma%' OR nome ILIKE '%Urgência%' THEN 85
        WHEN nome ILIKE '%Pré-natal%' THEN 80
        ELSE 40 END,
    'enamed_incidence', 60,
    'search_frequency', 70,
    'tutor_v3_potential', 80,
    'recovery_mode_potential', 90,
    'hospital_virtual_potential', 30,
    'fsrs_impact', 50,
    'simulado_potential', 100
);

-- Apply RVS and Priority
UPDATE public.curriculum_topics
SET rvs_score = calculate_rvs_score(id);

UPDATE public.curriculum_topics
SET recovery_priority = classify_recovery_priority(rvs_score);

-- 6. View for the Ranking (Phase 2)
CREATE OR REPLACE VIEW public.v_fccp_recovery_ranking AS
SELECT 
    id,
    nome,
    rvs_score,
    recovery_priority,
    visible_questions,
    recoverable_questions,
    rps,
    status as current_operational_status
FROM public.curriculum_topics
ORDER BY rvs_score DESC;
