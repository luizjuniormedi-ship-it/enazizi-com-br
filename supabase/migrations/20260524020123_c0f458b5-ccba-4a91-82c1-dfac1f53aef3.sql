-- 1. Harden runtime_incidents table
ALTER TABLE public.runtime_incidents 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS incident_type TEXT DEFAULT 'runtime_error';

-- 2. Performance Indices for Telemetry & Sessions
CREATE INDEX IF NOT EXISTS idx_runtime_incidents_user_id ON public.runtime_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_runtime_incidents_correlation_id ON public.runtime_incidents(correlation_id);
CREATE INDEX IF NOT EXISTS idx_tutor_ia_telemetry_user_id ON public.tutor_ia_telemetry(user_id);
CREATE INDEX IF NOT EXISTS idx_tutor_ia_telemetry_session_id ON public.tutor_ia_telemetry(session_id);
CREATE INDEX IF NOT EXISTS idx_pedagogical_sessions_conv_id ON public.pedagogical_sessions(conversation_id);

-- 3. Ensure RLS on all Enterprise Tables
ALTER TABLE public.runtime_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_ia_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own incidents' AND tablename = 'runtime_incidents') THEN
        CREATE POLICY "Users can view their own incidents" ON public.runtime_incidents FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own telemetry' AND tablename = 'tutor_ia_telemetry') THEN
        CREATE POLICY "Users can view their own telemetry" ON public.tutor_ia_telemetry FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Add metadata to tutor_messages if missing (for tracing)
ALTER TABLE public.tutor_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_tutor_messages_session_id ON public.tutor_messages(tutor_session_id);
