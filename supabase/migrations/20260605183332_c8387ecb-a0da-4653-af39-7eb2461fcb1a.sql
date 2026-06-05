-- Step 1: Ensure telemetry table exists
CREATE TABLE IF NOT EXISTS public.system_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.system_telemetry TO authenticated;
GRANT ALL ON public.system_telemetry TO service_role;
ALTER TABLE public.system_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all on telemetry" ON public.system_telemetry FOR ALL TO service_role USING (true);

-- Step 2: Update the trigger function to be robust
CREATE OR REPLACE FUNCTION public.log_institutional_event() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.system_telemetry (event_type, metadata)
    VALUES (TG_ARGV[0], jsonb_build_object(
        'id', NEW.id, 
        'table', TG_TABLE_NAME,
        'timestamp', now()
    ));
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fallback: log to postgres logs if table write fails, but don't block the transaction
    RAISE WARNING 'Failed to log telemetry event %: %', TG_ARGV[0], SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
