-- CCPV: Critical Competency Production Validation Framework

-- 1. Test Runs Table
CREATE TABLE IF NOT EXISTS public.ccpv_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_competency TEXT NOT NULL,
    resolved_alias TEXT,
    competency_id UUID, -- Not a hard FK as we found competency_id in competency_aliases is text-based or inconsistently mapped
    questions_requested INTEGER NOT NULL,
    questions_found INTEGER DEFAULT 0,
    questions_returned INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT FALSE,
    failure_reason TEXT,
    trace_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Topic Integrity Audit
CREATE TABLE IF NOT EXISTS public.ccpv_topic_integrity_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES public.ccpv_test_runs(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions_bank(id),
    is_valid_topic BOOLEAN DEFAULT TRUE,
    leakage_detected BOOLEAN DEFAULT FALSE,
    detected_topic_mismatch TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Performance Metrics
CREATE TABLE IF NOT EXISTS public.ccpv_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_run_id UUID REFERENCES public.ccpv_test_runs(id),
    alias_resolution_ms INTEGER,
    topic_engine_ms INTEGER,
    selector_ms INTEGER,
    total_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.ccpv_test_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ccpv_topic_integrity_audit TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ccpv_performance_metrics TO authenticated;
GRANT ALL ON public.ccpv_test_runs TO service_role;
GRANT ALL ON public.ccpv_topic_integrity_audit TO service_role;
GRANT ALL ON public.ccpv_performance_metrics TO service_role;

-- RLS
ALTER TABLE public.ccpv_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccpv_topic_integrity_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ccpv_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated users" ON public.ccpv_test_runs FOR SELECT USING (true);
CREATE POLICY "Allow read for authenticated users" ON public.ccpv_topic_integrity_audit FOR SELECT USING (true);
CREATE POLICY "Allow read for authenticated users" ON public.ccpv_performance_metrics FOR SELECT USING (true);

-- 4. View: Production Readiness Certification Matrix
CREATE OR REPLACE VIEW public.v_ccpv_production_readiness AS
WITH stats AS (
    SELECT 
        requested_competency,
        questions_requested,
        COUNT(*) FILTER (WHERE success = TRUE) as successful_runs,
        AVG(questions_returned)::NUMERIC(10,2) as avg_returned,
        MAX(questions_returned) as max_capacity,
        AVG(execution_time_ms)::NUMERIC(10,2) as avg_latency_ms,
        (COUNT(*) FILTER (WHERE success = TRUE AND questions_returned >= questions_requested)::FLOAT / NULLIF(COUNT(*), 0) * 100)::NUMERIC(5,2) as uis_score
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

-- 5. Helper Function for Automated Test Suite
CREATE OR REPLACE FUNCTION public.ccpv_run_test_suite(p_competency_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_comp_id UUID;
    v_alias TEXT;
    v_count_physical INTEGER;
    v_count_mapped INTEGER;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_test_run_id UUID;
    v_q_requested INTEGER[] := ARRAY[10, 20, 50, 100];
    v_q INTEGER;
    v_returned INTEGER;
    v_latency INTEGER;
BEGIN
    -- 1. Alias Resolution (using text-based competency_id mapping)
    SELECT alias INTO v_alias
    FROM competency_aliases
    WHERE alias ILIKE p_competency_name
    LIMIT 1;

    -- 2. Physical Count (Keyword search)
    SELECT count(*) INTO v_count_physical
    FROM questions_bank
    WHERE (statement ILIKE '%' || p_competency_name || '%' OR topic ILIKE '%' || p_competency_name || '%');

    -- 3. Mapped Count (Actual link in bank)
    SELECT count(*) INTO v_count_mapped
    FROM questions_bank
    WHERE (topic ILIKE '%' || p_competency_name || '%' OR curriculum_competency ILIKE '%' || p_competency_name || '%')
    AND lifecycle_state = 'published';

    -- 4. Execute test runs
    FOREACH v_q IN ARRAY v_q_requested LOOP
        v_start_time := clock_timestamp();
        
        -- Select real questions
        SELECT count(*) INTO v_returned
        FROM (
            SELECT id FROM questions_bank
            WHERE (topic ILIKE '%' || p_competency_name || '%' OR curriculum_competency ILIKE '%' || p_competency_name || '%')
            AND lifecycle_state = 'published'
            LIMIT v_q
        ) sub;

        v_end_time := clock_timestamp();
        v_latency := EXTRACT(MILLISECOND FROM (v_end_time - v_start_time));

        INSERT INTO public.ccpv_test_runs (
            requested_competency,
            resolved_alias,
            questions_requested,
            questions_found,
            questions_returned,
            execution_time_ms,
            success,
            failure_reason
        ) VALUES (
            p_competency_name,
            v_alias,
            v_q,
            v_count_mapped,
            v_returned,
            v_latency,
            (v_returned > 0),
            CASE WHEN v_returned = 0 THEN 'NO_QUESTIONS_RETURNED' ELSE NULL END
        ) RETURNING id INTO v_test_run_id;

        -- Capture specific questions for integrity audit
        INSERT INTO public.ccpv_topic_integrity_audit (test_run_id, question_id)
        SELECT v_test_run_id, id 
        FROM questions_bank
        WHERE (topic ILIKE '%' || p_competency_name || '%' OR curriculum_competency ILIKE '%' || p_competency_name || '%')
        AND lifecycle_state = 'published'
        LIMIT v_q;

    END LOOP;

    RETURN jsonb_build_object(
        'competency', p_competency_name,
        'physical_count', v_count_physical,
        'mapped_count', v_count_mapped,
        'status', 'TEST_COMPLETE'
    );
END;
$$;
