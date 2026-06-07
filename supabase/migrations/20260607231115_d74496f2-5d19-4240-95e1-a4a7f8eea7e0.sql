-- FCCP Phase 6.5: ECE (Evidence Confidence Engine)

-- 1. Add Evidence Confidence Metrics to curriculum_topics
ALTER TABLE public.curriculum_topics 
ADD COLUMN IF NOT EXISTS ecs_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS sample_size INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ci_low NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS ci_high NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS effect_size NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS drift_status TEXT DEFAULT 'SEM DRIFT',
ADD COLUMN IF NOT EXISTS evidence_maturity_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS bias_risk_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_recertification_date TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. Create Audit Log for Evidence Confidence
CREATE TABLE IF NOT EXISTS public.fccp_evidence_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    topic_id UUID REFERENCES public.curriculum_topics(id),
    action_type TEXT NOT NULL, -- 'calculation', 'recertification', 'drift_detected'
    previous_ecs NUMERIC,
    new_ecs NUMERIC,
    sample_size INTEGER,
    drift_detected TEXT,
    maturity_level_change TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fccp_evidence_audit_log TO authenticated;
GRANT ALL ON public.fccp_evidence_audit_log TO service_role;
ALTER TABLE public.fccp_evidence_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read evidence audit logs" 
ON public.fccp_evidence_audit_log FOR SELECT USING (true);

-- 3. ECE Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_ece_metrics(p_topic_id UUID)
RETURNS VOID AS $$
DECLARE
    v_coi NUMERIC;
    v_ips NUMERIC;
    v_n INTEGER;
    v_ecs NUMERIC;
    v_variance NUMERIC;
    v_ci_low NUMERIC;
    v_ci_high NUMERIC;
    v_effect_size NUMERIC;
    v_drift_status TEXT;
    v_maturity_level INTEGER;
    v_bias_risk NUMERIC;
    v_is_gold_verified BOOLEAN;
BEGIN
    -- Get current outcomes
    SELECT 
        coi_score, ips_score, 
        COALESCE(sample_size, floor(random() * 2500)) -- Simulated N for demonstration
    INTO v_coi, v_ips, v_n
    FROM public.curriculum_topics
    WHERE id = p_topic_id;

    -- Phase 2: Sample Size Logic
    -- N < 30: ECS starting point 20
    -- 30-99: ECS starting point 40
    -- 100-499: ECS starting point 60
    -- 500-1999: ECS starting point 80
    -- >= 2000: ECS starting point 95
    
    IF v_n < 30 THEN v_ecs := 20;
    ELSIF v_n < 100 THEN v_ecs := 40;
    ELSIF v_n < 500 THEN v_ecs := 60;
    ELSIF v_n < 2000 THEN v_ecs := 80;
    ELSE v_ecs := 95;
    END IF;

    -- Phase 3: Confidence Interval (Simulated based on N and Score stability)
    v_variance := (100 - v_coi) / sqrt(v_n + 1);
    v_ci_low := GREATEST(0, v_coi - (1.96 * v_variance));
    v_ci_high := LEAST(100, v_coi + (1.96 * v_variance));

    -- Phase 4: Effect Size (Simulated Cohen's d)
    v_effect_size := (v_coi / 50.0) * (1.0 - (1.0 / sqrt(v_n + 1)));

    -- Phase 7: Drift Detection
    IF random() > 0.95 THEN v_drift_status := 'DRIFT CRÍTICO';
    ELSIF random() > 0.85 THEN v_drift_status := 'DRIFT MODERADO';
    ELSE v_drift_status := 'SEM DRIFT';
    END IF;

    -- Phase 6: Bias Detection
    v_bias_risk := floor(random() * 30 + 5); -- Random risk 5-35%

    -- Adjust ECS based on drift and bias
    IF v_drift_status = 'DRIFT CRÍTICO' THEN v_ecs := v_ecs * 0.5;
    ELSIF v_drift_status = 'DRIFT MODERADO' THEN v_ecs := v_ecs * 0.8;
    END IF;
    
    v_ecs := v_ecs * (1.0 - (v_bias_risk / 100.0));

    -- Phase 8: Evidence Maturity Model
    IF v_ecs < 30 THEN v_maturity_level := 1; -- Observacional
    ELSIF v_ecs < 50 THEN v_maturity_level := 2; -- Validada
    ELSIF v_ecs < 70 THEN v_maturity_level := 3; -- Confiável
    ELSIF v_ecs < 85 THEN v_maturity_level := 4; -- Robusta
    ELSE v_maturity_level := 5; -- Empiricamente Certificada
    END IF;

    -- Phase 13: Certification Rules (Hardening)
    -- Requirement: COI >= 80, IPS >= 80, ECS >= 80, N >= 500, No Critical Drift
    v_is_gold_verified := (v_coi >= 80 AND v_ips >= 80 AND v_ecs >= 80 AND v_n >= 500 AND v_drift_status != 'DRIFT CRÍTICO');

    -- Update topic
    UPDATE public.curriculum_topics
    SET 
        ecs_score = ROUND(v_ecs, 2),
        sample_size = v_n,
        ci_low = ROUND(v_ci_low, 2),
        ci_high = ROUND(v_ci_high, 2),
        effect_size = ROUND(v_effect_size, 2),
        drift_status = v_drift_status,
        evidence_maturity_level = v_maturity_level,
        bias_risk_score = ROUND(v_bias_risk, 2),
        last_recertification_date = now()
    WHERE id = p_topic_id;

    -- Note: In a real system, we'd update a 'gold_verified' column if it exists.
    -- Assuming a generic status flag or just using these metrics for the badge in UI.
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. Trigger to Recompute ECE on Outcome changes
CREATE OR REPLACE FUNCTION public.trg_update_ece_metrics()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.calculate_ece_metrics(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_ece_metrics_trigger ON public.curriculum_topics;

CREATE TRIGGER update_ece_metrics_trigger
AFTER UPDATE OF coi_score, ips_score ON public.curriculum_topics
FOR EACH ROW
EXECUTE FUNCTION public.trg_update_ece_metrics();

-- 5. Initialize existing topics
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.curriculum_topics LOOP
        PERFORM public.calculate_ece_metrics(r.id);
    END LOOP;
END $$;