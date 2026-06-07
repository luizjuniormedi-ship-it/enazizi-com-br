-- Update CCPV Test Suite with correct production filters
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
    v_search_term TEXT;
BEGIN
    v_search_term := '%' || p_competency_name || '%';

    -- 1. Alias Resolution
    SELECT alias INTO v_alias
    FROM competency_aliases
    WHERE alias ILIKE p_competency_name
    LIMIT 1;

    -- 2. Physical Count (Keyword search)
    SELECT count(*) INTO v_count_physical
    FROM questions_bank
    WHERE (statement ILIKE v_search_term OR topic ILIKE v_search_term);

    -- 3. Mapped Count (Production eligible)
    SELECT count(*) INTO v_count_mapped
    FROM questions_bank
    WHERE (
        topic ILIKE v_search_term 
        OR curriculum_competency ILIKE v_search_term 
        OR curriculum_theme ILIKE v_search_term
    )
    AND lifecycle_state IN ('published', 'generated'); -- 'generated' is the current production state for most questions

    -- Clean old runs for this competency to avoid pollution
    DELETE FROM public.ccpv_test_runs WHERE requested_competency = p_competency_name;

    -- 4. Execute test runs
    FOREACH v_q IN ARRAY v_q_requested LOOP
        v_start_time := clock_timestamp();
        
        -- Select real questions
        SELECT count(*) INTO v_returned
        FROM (
            SELECT id FROM questions_bank
            WHERE (
                topic ILIKE v_search_term 
                OR curriculum_competency ILIKE v_search_term 
                OR curriculum_theme ILIKE v_search_term
            )
            AND lifecycle_state IN ('published', 'generated')
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
            (v_returned >= v_q OR (v_returned > 0 AND v_returned = v_count_mapped)), -- Success if requested quantity met OR all available returned
            CASE WHEN v_returned = 0 THEN 'NO_QUESTIONS_RETURNED' 
                 WHEN v_returned < v_q AND v_returned < v_count_mapped THEN 'SELECTOR_FAILURE'
                 ELSE NULL END
        ) RETURNING id INTO v_test_run_id;

        -- Integrity audit capture
        INSERT INTO public.ccpv_topic_integrity_audit (test_run_id, question_id)
        SELECT v_test_run_id, id 
        FROM questions_bank
        WHERE (
            topic ILIKE v_search_term 
            OR curriculum_competency ILIKE v_search_term 
            OR curriculum_theme ILIKE v_search_term
        )
        AND lifecycle_state IN ('published', 'generated')
        LIMIT v_q;

    END LOOP;

    RETURN jsonb_build_object(
        'competency', p_competency_name,
        'physical_count', v_count_physical,
        'eligible_count', v_count_mapped,
        'status', 'TEST_COMPLETE'
    );
END;
$$;
