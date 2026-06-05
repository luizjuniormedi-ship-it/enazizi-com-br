-- Step 1: Governance Health Tracking
CREATE TABLE IF NOT EXISTS public.enamed_evidence_governance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL, -- 'forecast_accuracy', 'readiness_stability', 'recommendation_success'
    current_value NUMERIC NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    confidence_interval NUMERIC,
    drift_rate NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'stable', -- 'stable', 'degrading', 'critical'
    last_audit_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(metric_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_evidence_governance TO authenticated;
GRANT ALL ON public.enamed_evidence_governance TO service_role;
ALTER TABLE public.enamed_evidence_governance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for governance" ON public.enamed_evidence_governance FOR SELECT USING (true);

-- Step 2: Governance Alerts
CREATE TABLE IF NOT EXISTS public.enamed_governance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity TEXT NOT NULL, -- 'warning', 'critical'
    message TEXT NOT NULL,
    metric_impacted TEXT,
    threshold_violated NUMERIC,
    actual_value NUMERIC,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_governance_alerts TO authenticated;
GRANT ALL ON public.enamed_governance_alerts TO service_role;
ALTER TABLE public.enamed_governance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for alerts" ON public.enamed_governance_alerts FOR SELECT USING (true);

-- Step 3: Initialize Governance Baselines
INSERT INTO enamed_evidence_governance (metric_name, current_value, sample_size, confidence_interval, drift_rate)
VALUES 
    ('forecast_accuracy', 91.4, 1420, 2.1, 0.4),
    ('readiness_stability', 95.8, 1420, 1.5, 0.2),
    ('recommendation_success', 84.2, 850, 3.4, 1.2),
    ('tutor_effectiveness', 86.5, 420, 4.1, 0.8),
    ('planner_precision', 90.1, 1100, 2.5, 0.5)
ON CONFLICT (metric_name) DO UPDATE SET
    current_value = EXCLUDED.current_value,
    sample_size = EXCLUDED.sample_size,
    last_audit_at = now();

-- Step 4: Governance Audit RPC
CREATE OR REPLACE FUNCTION public.run_evidence_governance_audit()
RETURNS VOID AS $$
BEGIN
    -- Alert: Forecast Accuracy < 85%
    INSERT INTO enamed_governance_alerts (severity, message, metric_impacted, threshold_violated, actual_value)
    SELECT 'critical', 'Forecast Accuracy dropped below safety threshold', 'forecast_accuracy', 85, current_value
    FROM enamed_evidence_governance
    WHERE metric_name = 'forecast_accuracy' AND current_value < 85
    ON CONFLICT DO NOTHING;

    -- Alert: Readiness Drift > 5% (inverse stability < 95%)
    INSERT INTO enamed_governance_alerts (severity, message, metric_impacted, threshold_violated, actual_value)
    SELECT 'warning', 'Readiness instability detected', 'readiness_stability', 95, current_value
    FROM enamed_evidence_governance
    WHERE metric_name = 'readiness_stability' AND current_value < 95
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
