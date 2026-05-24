-- Schedule the ingestion pipeline to run every 5 minutes
-- Using a DO block to safely handle existing jobs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drive-ingestion-pipeline') THEN
        PERFORM cron.unschedule('drive-ingestion-pipeline');
    END IF;
    
    PERFORM cron.schedule(
        'drive-ingestion-pipeline',
        '*/5 * * * *',
        $cron$ SELECT net.http_post(
            url := 'https://kojqbvrhodpchtnainla.supabase.co/functions/v1/drive-exam-ingestion',
            headers := '{"Content-Type": "application/json", "Authorization": "Bearer 0af48797-38f2-4b77-bd16-0486fa291eba"}'::jsonb,
            body := '{}'::jsonb
        ) $cron$
    );
END $$;