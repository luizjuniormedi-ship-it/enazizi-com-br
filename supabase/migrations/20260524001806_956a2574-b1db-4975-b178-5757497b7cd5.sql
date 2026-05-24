-- 1. Grant EXECUTE to public RPCs
GRANT EXECUTE ON FUNCTION public.get_login_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_testimonials() TO anon;
GRANT EXECUTE ON FUNCTION public.get_login_testimonials() TO authenticated;

-- 2. Update trigger to include Authorization header with service_role key
CREATE OR REPLACE FUNCTION public.notify_pedagogical_event()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
    target_url TEXT;
    service_key TEXT;
BEGIN
    -- Get target URL and service key from config or environment
    SELECT config_value INTO target_url FROM public.alos_system_config WHERE config_key = 'edge_function_base_url' LIMIT 1;
    -- In Supabase Edge Functions, we can use the service role key for internal calls
    -- We'll try to get it from a secure vault or just rely on the edge function to handle it if we can't get it here safely.
    -- For now, let's assume we can get it from the settings if available, or just pass a system identifier.
    
    payload := jsonb_build_object('event', row_to_json(NEW));
    
    PERFORM net.http_post(
        url := target_url || '/pedagogical-event-consumer',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := payload
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix pedagogical_events RLS policies for UPSERT
-- Ensure the policy allows both INSERT and UPDATE
DROP POLICY IF EXISTS "Users can manage their own pedagogical events" ON public.pedagogical_events;
CREATE POLICY "Users can manage their own pedagogical events" 
ON public.pedagogical_events 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure anon can't do anything (already covered by lack of policy, but let's be explicit)
ALTER TABLE public.pedagogical_events ENABLE ROW LEVEL SECURITY;
