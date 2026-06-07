-- FCCP Phase 6.4: COVE (Curriculum Outcome Validation Engine)

-- 1. Add Outcome Metrics to curriculum_topics
ALTER TABLE public.curriculum_topics 
ADD COLUMN IF NOT EXISTS coi_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ips_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS learning_yield NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS retention_gain NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS transfer_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS approval_correlation NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS longitudinal_mastery NUMERIC DEFAULT 0;

-- 2. Create Audit Log for Outcomes
CREATE TABLE IF NOT EXISTS public.fccp_outcome_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    topic_id UUID REFERENCES public.curriculum_topics(id),
    action_type TEXT NOT NULL, -- 'recovery', 'generation', 'validation'
    previous_coi NUMERIC,
    new_coi NUMERIC,
    previous_ips NUMERIC,
    new_ips NUMERIC,
    learning_yield_change NUMERIC,
    retention_gain_change NUMERIC,
    transfer_score_change NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fccp_outcome_audit_log TO authenticated;
GRANT ALL ON public.fccp_outcome_audit_log TO service_role;
ALTER TABLE public.fccp_outcome_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read outcome audit logs" 
ON public.fccp_outcome_audit_log FOR SELECT USING (true);

-- 3. COI and IPS Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_cove_metrics(p_topic_id UUID)
RETURNS VOID AS $$
DECLARE
    v_learning_yield NUMERIC;
    v_retention_gain NUMERIC;
    v_transfer_score NUMERIC;
    v_hospital_performance NUMERIC;
    v_approval_correlation NUMERIC;
    v_longitudinal_mastery NUMERIC;
    v_coi NUMERIC;
    v_cri NUMERIC;
    v_ips NUMERIC;
BEGIN
    -- Simulation of educational data (In a real scenario, this would aggregate actual user data)
    SELECT 
        COALESCE(learning_yield, floor(random() * 40 + 30)),
        COALESCE(retention_gain, floor(random() * 30 + 40)),
        COALESCE(transfer_score, floor(random() * 50 + 20)),
        COALESCE(approval_correlation, floor(random() * 60 + 20)),
        COALESCE(longitudinal_mastery, floor(random() * 40 + 10)),
        COALESCE(cri_score, 0)
    INTO 
        v_learning_yield, v_retention_gain, v_transfer_score, 
        v_approval_correlation, v_longitudinal_mastery, v_cri
    FROM public.curriculum_topics
    WHERE id = p_topic_id;

    -- COI Composition:
    -- 25% Learning Yield
    -- 20% Retention Gain
    -- 20% Transfer Score
    -- 15% Hospital Performance (part of transfer_score in this model)
    -- 10% Approval Correlation
    -- 10% Longitudinal Mastery
    
    v_coi := (v_learning_yield * 0.25) + 
             (v_retention_gain * 0.20) + 
             (v_transfer_score * 0.35) + 
             (v_approval_correlation * 0.10) + 
             (v_longitudinal_mastery * 0.10);

    -- IPS (Impact Priority Score) = CRI * (COI / 100)
    v_ips := v_cri * (v_coi / 100.0);

    UPDATE public.curriculum_topics
    SET 
        coi_score = ROUND(v_coi, 2),
        ips_score = ROUND(v_ips, 2)
    WHERE id = p_topic_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Trigger to Recompute COVE on CRI changes
CREATE OR REPLACE FUNCTION public.trg_update_cove_metrics()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.calculate_cove_metrics(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop if exists to avoid conflicts during retry
DROP TRIGGER IF EXISTS update_cove_metrics_trigger ON public.curriculum_topics;

CREATE TRIGGER update_cove_metrics_trigger
AFTER UPDATE OF cri_score, learning_yield, retention_gain, transfer_score, approval_correlation ON public.curriculum_topics
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_cove_metrics();

-- 5. Initialize existing topics
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.curriculum_topics LOOP
        PERFORM public.calculate_cove_metrics(r.id);
    END LOOP;
END $$;
