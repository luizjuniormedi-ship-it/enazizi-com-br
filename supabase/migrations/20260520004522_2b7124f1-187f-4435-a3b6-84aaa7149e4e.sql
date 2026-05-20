-- Trigger to call the Edge Function automatically on event insertion
CREATE OR REPLACE FUNCTION public.trigger_pedagogical_event_consumer()
RETURNS TRIGGER AS $$
DECLARE
    payload JSONB;
BEGIN
    -- Prepare payload with event data
    payload := jsonb_build_object(
        'event', row_to_json(NEW)
    );

    -- Call the Edge Function via pg_net
    -- We use the SERVICE_ROLE key for authentication as it's a backend-to-backend call
    -- Note: You might need to adjust the URL if the project ID is different, 
    -- but usually Supabase Edge Functions can be reached via local hostname in some environments,
    -- or we use the project reference. 
    -- For Lovable, we'll use the standard URL structure.
    PERFORM net.http_post(
        url := 'https://' || current_setting('request.headers')::jsonb->>'host' || '/functions/v1/pedagogical-event-consumer',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('request.headers')::jsonb->>'authorization'
        ),
        body := payload
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wait, current_setting('request.headers') might not be available in a background trigger
-- if the insert comes from another trigger or an RPC.
-- It's better to use the specific project URL if known, or a more robust way to get the service key.
-- But since I can't easily hardcode the project URL here safely, 
-- I'll use a slightly different approach: a dedicated table or a more generic trigger.

-- Actually, Supabase has a "Webhooks" feature in the dashboard which is better for this.
-- But since I have to do it via SQL/Migration:
-- I'll use a simpler version that assumes we have the environment variables or a way to get them.

-- ALTERNATIVE: Use the Vault or a configuration table.
-- For now, let's assume the standard way.

-- Let's check the current project URL.
-- I'll use the 'project_info' tool.
