CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    session_id UUID NOT NULL,
    event_name TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    route TEXT,
    device_type TEXT,
    screen_size TEXT,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Policy for inserting events (any authenticated user)
CREATE POLICY "Users can insert their own telemetry events" 
ON public.telemetry_events 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy for admins/internal viewing (if we want to restrict SELECT)
-- For now, let's allow users to see their own if needed, but the admin panel will need more.
CREATE POLICY "Users can view their own telemetry events" 
ON public.telemetry_events 
FOR SELECT 
USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_telemetry_event_name ON public.telemetry_events (event_name);
CREATE INDEX idx_telemetry_user_timestamp ON public.telemetry_events (user_id, timestamp DESC);
CREATE INDEX idx_telemetry_session ON public.telemetry_events (session_id);