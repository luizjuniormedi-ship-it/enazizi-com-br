CREATE OR REPLACE FUNCTION public.calculate_cme_job_costs()
RETURNS TRIGGER AS $$
DECLARE
  base_cost_per_min FLOAT := 0.50; 
  gpu_duration FLOAT;
  total_cost FLOAT;
  start_time TIMESTAMPTZ;
BEGIN
  start_time := COALESCE(NEW.started_at, NEW.queued_at, (now() - interval '5 minutes'));

  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    gpu_duration := EXTRACT(EPOCH FROM (COALESCE(NEW.completed_at, now()) - start_time)) / 60.0;
    IF gpu_duration <= 0 THEN gpu_duration := 1.0; END IF;
    total_cost := gpu_duration * base_cost_per_min;

    INSERT INTO public.cme_render_costs (
      render_job_id,
      worker_id,
      gpu_minutes,
      estimated_cost,
      render_quality
    ) VALUES (
      NEW.id,
      NEW.gpu_worker_id,
      gpu_duration,
      total_cost,
      COALESCE(NEW.cinematic_quality_score::text, '0.0')
    );
    
    INSERT INTO public.cme_gpu_cost_metrics (
      render_job_id,
      worker_id,
      vram_minutes,
      estimated_cost
    ) VALUES (
      NEW.id,
      NEW.gpu_worker_id,
      gpu_duration, -- mapped to vram_minutes for simplicity in test
      total_cost
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
