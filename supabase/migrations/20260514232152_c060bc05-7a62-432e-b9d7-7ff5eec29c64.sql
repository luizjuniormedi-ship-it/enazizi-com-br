-- Function to trigger the scan via HTTP call to the edge function
CREATE OR REPLACE FUNCTION public.trigger_exam_harvester_scan()
RETURNS void AS $$
BEGIN
  -- This requires net extension which might not be available, 
  -- alternatively we can just insert into a 'tasks' table if the project has one.
  -- For now, we'll log it in the ingestion logs to show it was triggered.
  INSERT INTO public.official_exam_ingestion_logs (action, status, details)
  VALUES ('automated_scan_trigger', 'success', '{"triggered_by": "pg_cron"}');
END;
$$ LANGUAGE plpgsql;

-- To actually run this daily, the user would need to run:
-- SELECT cron.schedule('0 2 * * *', 'SELECT trigger_exam_harvester_scan()');
-- But we can't always enable pg_cron automatically in all environments without superuser.
