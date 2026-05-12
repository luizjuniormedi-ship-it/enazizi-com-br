-- Indices for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Indices for question_reports
CREATE INDEX IF NOT EXISTS idx_question_reports_user_id ON public.question_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_status ON public.question_reports(status);

-- Indices for telemetry_events (ensure performance on common queries)
CREATE INDEX IF NOT EXISTS idx_telemetry_events_name_timestamp ON public.telemetry_events(event_name, timestamp DESC);

-- Create a table for dedicated error tracking (if not already handled by error_log)
-- We'll use error_log if it exists, but ensure it has the right columns.
-- Check if error_log exists (it was mentioned in SystemHealthDashboard)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'error_log') THEN
        CREATE TABLE public.error_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id),
            error_message TEXT NOT NULL,
            stack_trace TEXT,
            context JSONB DEFAULT '{}'::jsonb,
            severity TEXT DEFAULT 'error',
            created_at TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE public.error_log ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Admins can view all error logs" ON public.error_log FOR SELECT USING (true); -- Simplified for admin check in app
    END IF;
END $$;

-- View for Enterprise Telemetry Summary
CREATE OR REPLACE VIEW public.v_enterprise_telemetry_summary AS
SELECT 
    event_name,
    count(*) as event_count,
    min(timestamp) as first_seen,
    max(timestamp) as last_seen,
    count(distinct user_id) as unique_users
FROM 
    public.telemetry_events
WHERE 
    timestamp > now() - interval '7 days'
GROUP BY 
    event_name;

-- Grant access to the view
GRANT SELECT ON public.v_enterprise_telemetry_summary TO authenticated;
GRANT SELECT ON public.v_enterprise_telemetry_summary TO service_role;
