-- Schedule the cron job to run every 3 minutes
SELECT cron.schedule(
    'reclassify-questions-cron',
    '*/3 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://kojqbvrhodpchtnainla.supabase.co/functions/v1/reclassify-questions',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_a3Ss3eqjxPUIaPs4vlqj9g_BcyzhvW_"}'::jsonb,
        body := '{}'::jsonb
    ) AS request_id;
    $$
);
