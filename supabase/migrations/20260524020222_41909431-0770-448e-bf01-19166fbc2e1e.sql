-- RPC to check for duplicate sessions
CREATE OR REPLACE FUNCTION check_duplicate_tutor_sessions()
RETURNS TABLE (conversation_id UUID, cluster_count BIGINT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT s.conversation_id, COUNT(*) as cluster_count
    FROM public.pedagogical_sessions s
    GROUP BY s.conversation_id
    HAVING COUNT(*) > 1;
END;
$$;

-- RPC to get average latency for tutor functions
CREATE OR REPLACE FUNCTION get_avg_tutor_latency(hours integer)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT AVG(latency_ms)
        FROM public.edge_execution_logs
        WHERE function_name LIKE 'tutor-%'
        AND created_at > (NOW() - (hours || ' hours')::interval)
    );
END;
$$;
