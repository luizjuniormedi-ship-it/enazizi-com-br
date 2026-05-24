SELECT cron.schedule(
  'drive-ingestion-pipeline',
  '*/5 * * * *',
  'SELECT net.http_post(
    url := ''https://kojqbvrhodpchtnainla.supabase.co/functions/v1/drive-exam-ingestion'',
    headers := ''{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_a3Ss3eqjxPUIaPs4vlqj9g_BcyzhvW_"}''::jsonb,
    body := ''{}''::jsonb
  ) AS request_id;'
);