SELECT cron.schedule(
  'drive-ingestion-pipeline',
  '*/5 * * * *',
  'SELECT net.http_post(
    url := ''https://qszsyskumcmuknumwxtk.supabase.co/functions/v1/drive-exam-ingestion'',
    headers := ''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenN5c2t1bWNtdWtudW13eHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDUwNjUsImV4cCI6MjA4NjIyMTA2NX0.B2Si8zb8YJcDhIsyj6edriyXsG3p2rP-NLrGfBFAoZw"}''::jsonb,
    body := ''{}''::jsonb
  ) AS request_id;'
);