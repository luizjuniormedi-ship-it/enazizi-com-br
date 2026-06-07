-- FCCP PHASE 6.3: CURRICULUM ROI ENGINE (CRI)

-- 1. Extend curriculum_topics with ROI metrics
ALTER TABLE public.curriculum_topics 
ADD COLUMN IF NOT EXISTS cri_score NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ccs_gain_potential NUMERIC(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS effort_level TEXT CHECK (effort_level IN ('BAIXO', 'MÉDIO', 'ALTO', 'CRÍTICO')) DEFAULT 'MÉDIO',
ADD COLUMN IF NOT EXISTS demand_score NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS recommended_action TEXT CHECK (recommended_action IN ('RECOVER', 'RECOVER FIRST', 'GENERATE', 'DEFER', 'MAINTAIN')),
ADD COLUMN IF NOT EXISTS ccs_score NUMERIC(5,4) DEFAULT 0, -- Normalized score if not already present
ADD COLUMN IF NOT EXISTS uis_score NUMERIC(5,4) DEFAULT 0, -- User Impact Score
ADD COLUMN IF NOT EXISTS exam_incidence NUMERIC(5,4) DEFAULT 0; -- Incidence weight

-- 2. Audit Log for Governance
CREATE TABLE IF NOT EXISTS public.fccp_cri_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id),
    action_taken TEXT,
    initial_cri NUMERIC(5,2),
    final_cri NUMERIC(5,2),
    initial_ccs NUMERIC(5,4),
    final_ccs NUMERIC(5,4),
    ccs_gain_realized NUMERIC(5,4),
    executed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.fccp_cri_audit_log TO authenticated;
GRANT ALL ON public.fccp_cri_audit_log TO service_role;
ALTER TABLE public.fccp_cri_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auditors can view logs" ON public.fccp_cri_audit_log FOR SELECT USING (true);

-- 3. CRI Calculation Logic
CREATE OR REPLACE FUNCTION public.calculate_cri_metrics()
RETURNS VOID AS $$
DECLARE
    total_topics_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_topics_count FROM public.curriculum_topics;
    
    -- Phase 2 & 3 & 4: Estimate Gain, Effort, and Demand
    UPDATE public.curriculum_topics
    SET 
        -- CCS Gain Potential: Base weight divided by total topics, adjusted by current deficit
        ccs_gain_potential = (1.0 / NULLIF(total_topics_count, 0)) * (1.0 - COALESCE(ccs_score, 0)),
        
        -- Effort Level: Low if high recovery potential (rps), High if no potential
        effort_level = CASE 
            WHEN rps >= 1.0 THEN 'BAIXO'
            WHEN rps >= 0.5 THEN 'MÉDIO'
            WHEN rps > 0 THEN 'ALTO'
            ELSE 'CRÍTICO'
        END,
        
        -- Demand Score: Simulated from incidence and user impact
        demand_score = (COALESCE(exam_incidence, 0) * 0.7 + COALESCE(uis_score, 0) * 0.3) * 100;

    -- Phase 5: CRI Calculation
    -- CRI = (CCS Gain * Impact * Demand) / Effort_Multiplier
    UPDATE public.curriculum_topics
    SET cri_score = GREATEST(0, LEAST(100,
        (ccs_gain_potential * 1000 * COALESCE(rvs_score, 0) * (demand_score / 100)) / 
        CASE 
            WHEN effort_level = 'BAIXO' THEN 1.0
            WHEN effort_level = 'MÉDIO' THEN 2.0
            WHEN effort_level = 'ALTO' THEN 4.0
            ELSE 8.0
        END
    ));

    -- Phase 8: Action Recommendation Engine
    UPDATE public.curriculum_topics
    SET recommended_action = CASE 
        WHEN status IN ('OPERACIONAL', 'ROBUSTA') THEN 'MAINTAIN'
        WHEN rps >= 1.0 THEN 'RECOVER'
        WHEN rps >= 0.5 THEN 'RECOVER FIRST'
        WHEN rps < 0.5 AND (status = 'CRÍTICA' OR ccs_score < 0.2) THEN 'GENERATE'
        ELSE 'DEFER'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CCS Acceleration Simulator
CREATE OR REPLACE FUNCTION public.simulate_ccs_acceleration(limit_count INTEGER)
RETURNS TABLE (
    simulated_ccs_gain NUMERIC(5,4),
    new_projected_ccs NUMERIC(5,4),
    target_competencies TEXT[]
) AS $$
DECLARE
    current_avg_ccs NUMERIC(5,4);
    projected_gain NUMERIC(5,4);
BEGIN
    SELECT AVG(ccs_score) INTO current_avg_ccs FROM public.curriculum_topics;
    
    SELECT SUM(ccs_gain_potential), ARRAY_AGG(nome)
    INTO projected_gain, target_competencies
    FROM (
        SELECT ccs_gain_potential, nome 
        FROM public.curriculum_topics 
        WHERE status NOT IN ('OPERACIONAL', 'ROBUSTA')
        ORDER BY cri_score DESC 
        LIMIT limit_count
    ) sub;

    RETURN QUERY SELECT 
        COALESCE(projected_gain, 0),
        COALESCE(current_avg_ccs + projected_gain, current_avg_ccs),
        target_competencies;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for auto-recalc on topic update
CREATE OR REPLACE FUNCTION public.trg_update_cri_on_topic_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.calculate_cri_metrics();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER update_cri_metrics
AFTER UPDATE OF rps, rvs_score, uis_score, exam_incidence, ccs_score ON public.curriculum_topics
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_update_cri_on_topic_change();

-- Initial run
SELECT public.calculate_cri_metrics();
