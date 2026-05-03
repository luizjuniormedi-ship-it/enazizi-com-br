
-- 1. Governance Logs Table
CREATE TABLE IF NOT EXISTS public.governance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id),
    action_type TEXT NOT NULL, -- 'threshold_change', 'csv_export', 'admin_access', 'critical_change', 'rca_generated', 'alert_ignored'
    target_table TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for governance_logs
ALTER TABLE public.governance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view governance logs"
    ON public.governance_logs FOR SELECT
    USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "System can insert governance logs"
    ON public.governance_logs FOR INSERT
    WITH CHECK (true);

-- 2. Admin Incidents Table
CREATE TABLE IF NOT EXISTS public.admin_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'ignored'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    category TEXT NOT NULL, -- 'ai_performance', 'system_error', 'user_abandonment', 'edge_function_latency'
    initial_event_id UUID REFERENCES public.telemetry_events(id),
    user_id UUID REFERENCES auth.users(id),
    route TEXT,
    edge_function TEXT,
    metrics_snapshot JSONB DEFAULT '{}'::jsonb,
    rca_diagnosis JSONB DEFAULT '{}'::jsonb,
    resolution_notes TEXT,
    occurrence_count INTEGER DEFAULT 1,
    last_occurrence_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for admin_incidents
ALTER TABLE public.admin_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage incidents"
    ON public.admin_incidents FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin' OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Alert Schedules Table (Basic for now, will support notification channels)
CREATE TABLE IF NOT EXISTS public.admin_alert_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES auth.users(id),
    frequency TEXT NOT NULL, -- 'daily_digest', 'weekly_digest', 'immediate_critical'
    notification_channels TEXT[] DEFAULT ARRAY['internal_dashboard'],
    filters JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for admin_alert_schedules
ALTER TABLE public.admin_alert_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their schedules"
    ON public.admin_alert_schedules FOR ALL
    USING (auth.uid() = admin_id);

-- 4. Function for Automatic RCA Generation (Basic heuristic)
CREATE OR REPLACE FUNCTION public.generate_incident_rca(incident_id UUID)
RETURNS JSONB AS $$
DECLARE
    incident_rec RECORD;
    diagnosis JSONB;
BEGIN
    SELECT * FROM public.admin_incidents WHERE id = incident_id INTO incident_rec;
    
    -- Heuristic diagnosis based on category and metrics
    diagnosis = jsonb_build_object(
        'probable_cause', CASE 
            WHEN incident_rec.category = 'ai_performance' THEN 'LLM Response Latency / Token Limit'
            WHEN incident_rec.category = 'edge_function_latency' THEN 'Cold Start or High Resource Usage'
            WHEN incident_rec.category = 'user_abandonment' THEN 'UI Friction or Complex Pedagogical Block'
            ELSE 'Unknown System Exception'
        END,
        'affected_scope', jsonb_build_object('route', incident_rec.route, 'function', incident_rec.edge_function),
        'suggested_steps', ARRAY['Check Cloud Logs', 'Verify Thresholds', 'Review Pedagogical Flow']
    );
    
    UPDATE public.admin_incidents 
    SET rca_diagnosis = diagnosis, 
        updated_at = now() 
    WHERE id = incident_id;
    
    -- Log RCA Generation
    INSERT INTO public.governance_logs (action_type, target_table, details, severity)
    VALUES ('rca_generated', 'admin_incidents', jsonb_build_object('incident_id', incident_id, 'diagnosis', diagnosis), 'info');
    
    RETURN diagnosis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for automated incident creation from telemetry (Example for critical errors)
CREATE OR REPLACE FUNCTION public.on_telemetry_event_incident_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- If event indicates a critical error or threshold breach (simplified logic)
    IF NEW.event_name = 'system_error' AND (NEW.properties->>'severity' = 'critical') THEN
        INSERT INTO public.admin_incidents (title, description, severity, category, initial_event_id, user_id, route)
        VALUES (
            'Critical System Error Detected',
            NEW.properties->>'error_message',
            'critical',
            'system_error',
            NEW.id,
            NEW.user_id,
            NEW.properties->>'pathname'
        )
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_telemetry_incident
AFTER INSERT ON public.telemetry_events
FOR EACH ROW EXECUTE FUNCTION public.on_telemetry_event_incident_trigger();

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_governance_logs_created_at ON public.governance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_incidents_status ON public.admin_incidents(status);
CREATE INDEX IF NOT EXISTS idx_admin_incidents_severity ON public.admin_incidents(severity);
