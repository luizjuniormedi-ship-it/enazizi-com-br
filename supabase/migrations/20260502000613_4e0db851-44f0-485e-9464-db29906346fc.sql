CREATE OR REPLACE FUNCTION public.calculate_cme_job_costs()
RETURNS TRIGGER AS $$
DECLARE
  base_cost_per_min FLOAT := 0.50; 
  gpu_duration FLOAT;
  total_cost FLOAT;
  start_time TIMESTAMPTZ;
BEGIN
  -- Use started_at if available, otherwise queued_at, otherwise current_timestamp - 5 min as fallback
  start_time := COALESCE(NEW.started_at, NEW.queued_at, (now() - interval '5 minutes'));

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Calculate duration in minutes
    gpu_duration := EXTRACT(EPOCH FROM (COALESCE(NEW.completed_at, now()) - start_time)) / 60.0;
    
    -- Ensure duration is at least 1 minute for test purposes if needed
    IF gpu_duration <= 0 THEN gpu_duration := 1.0; END IF;
    
    total_cost := gpu_duration * base_cost_per_min;

    INSERT INTO public.cme_render_costs (
      render_job_id,
      project_id,
      user_id,
      gpu_minutes,
      cost_usd,
      metadata
    ) VALUES (
      NEW.id,
      NEW.project_id,
      NEW.user_id,
      gpu_duration,
      total_cost,
      jsonb_build_object('calculated_at', now(), 'strategy', 'v1_standard', 'start_time_used', start_time)
    );
    
    INSERT INTO public.cme_gpu_cost_metrics (
      worker_id,
      cost_usd,
      metrics_data
    ) VALUES (
      NEW.gpu_worker_id,
      total_cost,
      jsonb_build_object('job_id', NEW.id, 'duration_min', gpu_duration)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
