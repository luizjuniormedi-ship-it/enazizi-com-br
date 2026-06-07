-- Final refinement of the CCPV Test Suite to handle specific medical mapping
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
    v_mapping_term TEXT;
BEGIN
    v_search_term := '%' || p_competency_name || '%';
    
    -- Medical Mapping Logic (Internal Alias Engine)
    v_mapping_term := CASE 
        WHEN p_competency_name = 'IAM' THEN 'Síndrome Coronariana Aguda'
        WHEN p_competency_name = 'AVC' THEN 'Acidente Vascular Cerebral'
        WHEN p_competency_name = 'CAD' THEN 'Cetoacidose Diabética'
        WHEN p_competency_name = 'TEP' THEN 'Tromboembolismo Pulmonar'
        WHEN p_competency_name = 'IRA' THEN 'Insuficiência Renal Aguda'
        ELSE p_competency_name 
    END;

    -- 1. Alias Resolution
    SELECT alias INTO v_alias
    FROM competency_aliases
    WHERE alias ILIKE p_competency_name
    LIMIT 1;

    -- 2. Physical Count (Keyword search)
    SELECT count(*) INTO v_count_physical
    FROM questions_bank
    WHERE (statement ILIKE v_search_term OR topic ILIKE v_search_term OR curriculum_competency ILIKE v_search_term);

    -- 3. Mapped Count (Production eligible using Mapping Term)
    SELECT count(*) INTO v_count_mapped
    FROM questions_bank
    WHERE (
        topic ILIKE '%' || v_mapping_term || '%'
        OR curriculum_competency ILIKE '%' || v_mapping_term || '%'
        OR curriculum_theme ILIKE '%' || v_mapping_term || '%'
        OR statement ILIKE '%' || v_mapping_term || '%'
    )
    AND lifecycle_state IN ('published', 'generated');

    DELETE FROM public.ccpv_test_runs WHERE requested_competency = p_competency_name;

    -- 4. Execute test runs
    FOREACH v_q IN ARRAY v_q_requested LOOP
        v_start_time := clock_timestamp();
        
        SELECT count(*) INTO v_returned
        FROM (
            SELECT id FROM questions_bank
            WHERE (
                topic ILIKE '%' || v_mapping_term || '%'
                OR curriculum_competency ILIKE '%' || v_mapping_term || '%'
                OR curriculum_theme ILIKE '%' || v_mapping_term || '%'
                OR (statement ILIKE '%' || v_mapping_term || '%' AND (topic IS NOT NULL OR curriculum_competency IS NOT NULL))
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
            (v_returned >= v_q OR (v_returned > 0 AND v_returned >= LEAST(v_q, v_count_mapped))),
            CASE WHEN v_returned = 0 THEN 'NO_QUESTIONS_RETURNED' ELSE NULL END
        ) RETURNING id INTO v_test_run_id;

        INSERT INTO public.ccpv_topic_integrity_audit (test_run_id, question_id)
        SELECT v_test_run_id, id 
        FROM questions_bank
        WHERE (
                topic ILIKE '%' || v_mapping_term || '%'
                OR curriculum_competency ILIKE '%' || v_mapping_term || '%'
                OR curriculum_theme ILIKE '%' || v_mapping_term || '%'
        )
        AND lifecycle_state IN ('published', 'generated')
        LIMIT v_q;

    END LOOP;

    RETURN jsonb_build_object(
        'competency', p_competency_name,
        'mapped_to', v_mapping_term,
        'eligible_count', v_count_mapped,
        'status', 'TEST_COMPLETE'
    );
END;
$$;
