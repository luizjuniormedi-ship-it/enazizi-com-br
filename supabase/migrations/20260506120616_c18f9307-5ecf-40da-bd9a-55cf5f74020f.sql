CREATE OR REPLACE FUNCTION public.admin_telemetry_optimization_report(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    start_date timestamp with time zone;
BEGIN
    start_date := now() - (interval '1 day' * _days);

    SELECT jsonb_build_object(
        'loading_times', (
            SELECT jsonb_agg(sub)
            FROM (
                SELECT 
                    route, 
                    round(avg((properties->>'load_time_ms')::numeric), 2) as avg_load_ms,
                    count(*) as samples
                FROM public.telemetry_events
                WHERE event_name = 'page_view' 
                AND timestamp > start_date
                AND properties->>'load_time_ms' IS NOT NULL
                GROUP BY route
                ORDER BY avg_load_ms DESC
                LIMIT 10
            ) sub
        ),
        'edge_function_performance', (
            SELECT jsonb_agg(sub)
            FROM (
                SELECT 
                    event_type as function_name,
                    round(avg(duration_ms), 2) as avg_duration_ms,
                    count(*) as calls
                FROM public.tutor_ia_telemetry
                WHERE created_at > start_date
                GROUP BY event_type
                ORDER BY avg_duration_ms DESC
            ) sub
        ),
        'error_rates', (
            SELECT jsonb_build_object(
                'total_500', count(*) FILTER (WHERE error_message ILIKE '%500%' OR error_message ILIKE '%Internal Server Error%'),
                'total_timeout', count(*) FILTER (WHERE error_message ILIKE '%timeout%' OR error_message ILIKE '%504%'),
                'total_runtime', count(*) FILTER (WHERE error_message ILIKE '%ReferenceError%' OR error_message ILIKE '%TypeError%'),
                'total_errors', count(*)
            )
            FROM public.error_log
            WHERE created_at > start_date
        ),
        'ai_metrics', (
            SELECT jsonb_build_object(
                'total_cost', round(sum(estimated_cost)::numeric, 4),
                'avg_latency_ms', round(avg(latency_ms), 2),
                'total_tokens', sum(input_tokens + output_tokens),
                'cache_hit_rate', round((count(*) FILTER (WHERE reused_from_cache = true)::numeric / nullif(count(*), 0) * 100), 2)
            )
            FROM public.ai_usage_logs
            WHERE created_at > start_date
        ),
        'tutor_ttft', (
            SELECT round(avg(time_to_first_block), 2)
            FROM public.telemetry_events
            WHERE event_name = 'response_stream_start'
            AND timestamp > start_date
        ),
        'blocked_duplicates', (
            SELECT count(*)
            FROM public.telemetry_events
            WHERE event_name = 'request_blocked_duplicate'
            AND timestamp > start_date
        )
    ) INTO result;

    RETURN result;
END;
$$;
