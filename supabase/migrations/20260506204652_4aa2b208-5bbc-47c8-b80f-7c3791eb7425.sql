UPDATE public.simulation_generation_jobs
SET 
  status = 'failed',
  error_message = 'orphaned_job_cleanup'
WHERE 
  status IN ('pending', 'processing') 
  AND created_at < now() - interval '10 minutes';