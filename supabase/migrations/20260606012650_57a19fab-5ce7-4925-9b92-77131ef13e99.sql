-- P0.2 Recovery Reliability Engine
CREATE TABLE IF NOT EXISTS public.recovery_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attempt_id UUID DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    error_detected TEXT,
    flashcard_created BOOLEAN DEFAULT false,
    fsrs_created BOOLEAN DEFAULT false,
    planner_updated BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_audit_log TO authenticated;
GRANT ALL ON public.recovery_audit_log TO service_role;
ALTER TABLE public.recovery_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own recovery audit logs" ON public.recovery_audit_log
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- P0.6 Metric Registry
CREATE TABLE IF NOT EXISTS public.metric_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL UNIQUE,
    formula TEXT,
    source_tables TEXT[],
    update_frequency TEXT,
    owner_module TEXT,
    version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metric_registry TO authenticated;
GRANT ALL ON public.metric_registry TO service_role;
ALTER TABLE public.metric_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read metric registry" ON public.metric_registry
    FOR SELECT TO authenticated USING (true);

-- Pre-populate Registry
INSERT INTO public.metric_registry (metric_name, formula, source_tables, owner_module, version)
VALUES 
('Readiness', 'Weighted accuracy + frequency + consistency', ARRAY['practice_attempts', 'exam_sessions'], 'Impact Engine', '1.0'),
('Forecast', 'Regression of Readiness over time', ARRAY['practice_attempts'], 'Evidence Engine', '1.0'),
('Approval Chance', 'Comparison of Forecast vs Target Percentile', ARRAY['exam_sessions'], 'Impact Engine', '1.0'),
('Learning Yield', 'Accuracy * Retention * Velocity', ARRAY['fsrs_cards', 'practice_attempts'], 'Pedagogical Engine', '1.0'),
('Transfer Score', 'Accuracy in new vs known scenarios', ARRAY['practice_attempts'], 'Evidence Engine', '1.0'),
('Impact Score', 'Yield * Topic Relevance', ARRAY['medical_domain_map'], 'Impact Engine', '1.0'),
('Gap Analysis', 'Mastery - Target Mastery', ARRAY['medical_domain_map'], 'Evidence Engine', '1.0'),
('Domain Mastery', 'Decayed weighted average of attempts', ARRAY['practice_attempts'], 'Knowledge Engine', '1.0')
ON CONFLICT (metric_name) DO NOTHING;

-- P0.3 Domain Map Real-Time Refresh
CREATE OR REPLACE FUNCTION public.refresh_domain_mastery()
RETURNS TRIGGER AS $$
BEGIN
    -- Update medical_domain_map based on recent activity
    -- This is a simplified version of the logic to keep domain mastery updated in real-time
    UPDATE public.medical_domain_map
    SET 
        mastery_level = (
            SELECT COALESCE(AVG(
                CASE 
                    WHEN correct THEN 100 
                    ELSE 0 
                END
            ), 0)
            FROM public.practice_attempts
            WHERE user_id = NEW.user_id 
            AND topic = NEW.topic
            AND created_at > now() - interval '30 days'
        ),
        updated_at = now()
    WHERE user_id = NEW.user_id AND topic = NEW.topic;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for refresh
DROP TRIGGER IF EXISTS tr_refresh_mastery_on_practice ON public.practice_attempts;
CREATE TRIGGER tr_refresh_mastery_on_practice
AFTER INSERT OR UPDATE ON public.practice_attempts
FOR EACH ROW EXECUTE FUNCTION public.refresh_domain_mastery();

-- P0.9 Traceability Engine (Log functions for traceability)
-- We use standard table audit triggers if available, or manual inserts for specific events.
-- Adding a generic event log table if it doesn't exist for traceability
CREATE TABLE IF NOT EXISTS public.system_trace_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- READINESS_UPDATED, FORECAST_RECALCULATED, etc.
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.system_trace_log TO authenticated;
GRANT ALL ON public.system_trace_log TO service_role;
ALTER TABLE public.system_trace_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own traces" ON public.system_trace_log
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
