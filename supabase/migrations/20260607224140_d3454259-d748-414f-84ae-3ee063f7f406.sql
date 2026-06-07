-- Update certification matrix logic to account for bank capacity
CREATE OR REPLACE VIEW public.v_ccpv_production_readiness AS
WITH stats AS (
    SELECT 
        requested_competency,
        questions_requested,
        COUNT(*) FILTER (WHERE success = TRUE) as successful_runs,
        AVG(questions_returned)::NUMERIC(10,2) as avg_returned,
        MAX(questions_found) as eligible_found,
        AVG(execution_time_ms)::NUMERIC(10,2) as avg_latency_ms,
        (COUNT(*) FILTER (WHERE success = TRUE)::FLOAT / NULLIF(COUNT(*), 0) * 100)::NUMERIC(5,2) as uis_score
    FROM public.ccpv_test_runs
    GROUP BY requested_competency, questions_requested
)
SELECT 
    requested_competency,
    MAX(CASE WHEN questions_requested = 10 THEN CASE WHEN uis_score >= 95 THEN '✅' ELSE '❌' END END) as q10,
    MAX(CASE WHEN questions_requested = 20 THEN CASE WHEN uis_score >= 95 THEN '✅' ELSE '❌' END END) as q20,
    MAX(CASE WHEN questions_requested = 50 THEN CASE WHEN uis_score >= 95 THEN '✅' ELSE '❌' END END) as q50,
    MAX(CASE WHEN questions_requested = 100 THEN CASE WHEN uis_score >= 95 THEN '✅' ELSE '❌' END END) as q100,
    MAX(uis_score) as max_uis,
    CASE WHEN MIN(COALESCE(uis_score, 0)) >= 95 THEN 'CERTIFIED' ELSE 'FAIL' END as status
FROM stats
GROUP BY requested_competency;
