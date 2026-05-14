-- Archive Strategy: Move logs older than 30 days to a history table or delete
CREATE OR REPLACE FUNCTION public.archive_telemetry_events()
RETURNS void AS $$
BEGIN
    -- Move to history (or just delete for simplification if not needed for long-term BI)
    DELETE FROM public.telemetry_events 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Unified metadata index for orchestrator
CREATE INDEX IF NOT EXISTS idx_orchestrator_decisions_user_created 
ON public.orchestrator_decisions (user_id, created_at DESC);

-- Cleanup redundant views if any exist from legacy phases
-- DROP VIEW IF EXISTS legacy_analytics_view;
