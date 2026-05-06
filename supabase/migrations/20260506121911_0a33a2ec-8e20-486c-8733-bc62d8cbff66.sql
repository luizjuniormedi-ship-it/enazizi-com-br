-- 1. SECURING LOGS (RLS)
ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own error logs" ON public.error_log;
CREATE POLICY "Users view own error logs" ON public.error_log
FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Users view own ai usage" ON public.ai_usage_logs;
CREATE POLICY "Users view own ai usage" ON public.ai_usage_logs
FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. INFRASTRUCTURE OPTIMIZATION
CREATE INDEX IF NOT EXISTS idx_ai_usage_perf ON public.ai_usage_logs (created_at DESC, latency_ms);
CREATE INDEX IF NOT EXISTS idx_error_log_recent ON public.error_log (created_at DESC);

-- 3. INCIDENT AUTOMATION TRIGGER
CREATE OR REPLACE FUNCTION public.track_incident_from_error()
RETURNS trigger AS $$
BEGIN
    -- Only promote high-severity errors to incidents
    IF NEW.error_message ILIKE '%500%' OR NEW.error_message ILIKE '%timeout%' OR NEW.error_message ILIKE '%ReferenceError%' THEN
        INSERT INTO public.incident_events (event_type, severity, source, metadata)
        VALUES ('auto_detected_fault', 'critical', 'error_log_monitor', jsonb_build_object('error_id', NEW.id, 'msg', LEFT(NEW.error_message, 255)));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_error_to_incident_v2
AFTER INSERT ON public.error_log
FOR EACH ROW EXECUTE FUNCTION public.track_incident_from_error();
