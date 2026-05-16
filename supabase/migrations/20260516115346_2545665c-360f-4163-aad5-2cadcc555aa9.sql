CREATE OR REPLACE FUNCTION public.update_pipeline_health(
    p_name TEXT,
    p_success INTEGER,
    p_error INTEGER,
    p_latency INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.pipeline_health_metrics (
        pipeline_name,
        success_count,
        error_count,
        avg_latency_ms,
        completion_rate,
        health_status
    )
    VALUES (
        p_name,
        p_success,
        p_error,
        p_latency,
        CASE WHEN (p_success + p_error) > 0 THEN p_success::FLOAT / (p_success + p_error) ELSE 1.0 END,
        CASE WHEN p_error > 5 THEN 'unstable' ELSE 'healthy' END
    )
    ON CONFLICT (pipeline_name) DO UPDATE
    SET 
        success_count = pipeline_health_metrics.success_count + EXCLUDED.success_count,
        error_count = pipeline_health_metrics.error_count + EXCLUDED.error_count,
        avg_latency_ms = (pipeline_health_metrics.avg_latency_ms + EXCLUDED.avg_latency_ms) / 2,
        completion_rate = (pipeline_health_metrics.success_count + EXCLUDED.success_count)::FLOAT / 
                          NULLIF(pipeline_health_metrics.success_count + EXCLUDED.success_count + pipeline_health_metrics.error_count + EXCLUDED.error_count, 0),
        last_health_check = now(),
        updated_at = now(),
        health_status = CASE 
            WHEN (pipeline_health_metrics.error_count + EXCLUDED.error_count) > 20 THEN 'critical'
            WHEN (pipeline_health_metrics.error_count + EXCLUDED.error_count) > 10 THEN 'unstable'
            ELSE 'healthy' 
        END;
END;
$$;
