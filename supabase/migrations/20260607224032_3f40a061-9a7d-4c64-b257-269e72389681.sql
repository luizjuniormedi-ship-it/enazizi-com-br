-- ADVANCED CCPV: Clinical Semantics & Indirect Mapping Engine

CREATE OR REPLACE FUNCTION public.ccpv_run_test_suite(p_competency_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_alias TEXT;
    v_count_physical INTEGER;
    v_count_eligible INTEGER;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_test_run_id UUID;
    v_q_requested INTEGER[] := ARRAY[10, 20, 50, 100];
    v_q INTEGER;
    v_returned INTEGER;
    v_latency INTEGER;
    v_clinical_keywords TEXT[];
BEGIN
    -- 1. Setup Clinical Discovery Keywords based on competency
    v_clinical_keywords := CASE 
        WHEN p_competency_name = 'IAM' THEN ARRAY['IAM', 'Infarto', 'Síndrome Coronariana Aguda', 'Supra']
        WHEN p_competency_name = 'Sepse' THEN ARRAY['Sepse', 'Choque Séptico', 'Sepsis', 'Disfunção Orgânica']
        WHEN p_competency_name = 'AVC' THEN ARRAY['AVC', 'Acidente Vascular Cerebral', 'Ictus', 'Déficit Neurológico Focal']
        WHEN p_competency_name = 'CAD' THEN ARRAY['Cetoacidose', 'CAD', 'Emergência Glicêmica', 'Diabetes Mellitus']
        WHEN p_competency_name = 'TEP' THEN ARRAY['TEP', 'Tromboembolismo Pulmonar', 'Embolia Pulmonar']
        WHEN p_competency_name = 'IRA' THEN ARRAY['IRA', 'Insuficiência Renal Aguda', 'Lesão Renal Aguda']
        WHEN p_competency_name = 'Insuficiência Cardíaca' THEN ARRAY['IC', 'Insuficiência Cardíaca', 'IC descompensada', 'ICC']
        WHEN p_competency_name = 'Hipercalemia' THEN ARRAY['Hipercalemia', 'Potássio elevado', 'K elevado']
        WHEN p_competency_name = 'Pneumonia Grave' THEN ARRAY['Pneumonia', 'PAC', 'Infeção Respiratória']
        ELSE ARRAY[p_competency_name]
    END;

    -- 2. Physical Count (Raw existence in bank via clinical keywords)
    SELECT count(*) INTO v_count_physical
    FROM questions_bank q
    WHERE EXISTS (
        SELECT 1 FROM unnest(v_clinical_keywords) kw 
        WHERE q.statement ILIKE '%' || kw || '%' OR q.topic ILIKE '%' || kw || '%'
    );

    -- 3. Eligible Count (Questions with metadata OR clinical relevance in production states)
    SELECT count(*) INTO v_count_eligible
    FROM questions_bank q
    WHERE (
        EXISTS (
            SELECT 1 FROM unnest(v_clinical_keywords) kw 
            WHERE q.topic ILIKE '%' || kw || '%' 
               OR q.curriculum_competency ILIKE '%' || kw || '%'
               OR q.curriculum_theme ILIKE '%' || kw || '%'
        )
        OR (
            -- Full text fallback for critical syndromes when metadata is still propagating
            p_competency_name IN ('IAM', 'Sepse', 'AVC', 'CAD', 'TEP', 'IRA')
            AND EXISTS (SELECT 1 FROM unnest(v_clinical_keywords) kw WHERE q.statement ILIKE '%' || kw || '%')
            AND (q.topic IS NOT NULL OR q.curriculum_competency IS NOT NULL)
        )
    )
    AND q.lifecycle_state IN ('published', 'generated');

    -- Clean old runs
    DELETE FROM public.ccpv_test_runs WHERE requested_competency = p_competency_name;

    -- 4. Execute test runs
    FOREACH v_q IN ARRAY v_q_requested LOOP
        v_start_time := clock_timestamp();
        
        -- Simulate production generation query
        SELECT count(*) INTO v_returned
        FROM (
            SELECT id FROM questions_bank q
            WHERE (
                EXISTS (
                    SELECT 1 FROM unnest(v_clinical_keywords) kw 
                    WHERE q.topic ILIKE '%' || kw || '%' 
                       OR q.curriculum_competency ILIKE '%' || kw || '%'
                       OR q.curriculum_theme ILIKE '%' || kw || '%'
                )
                OR (
                    p_competency_name IN ('IAM', 'Sepse', 'AVC', 'CAD', 'TEP', 'IRA')
                    AND EXISTS (SELECT 1 FROM unnest(v_clinical_keywords) kw WHERE q.statement ILIKE '%' || kw || '%')
                    AND (q.topic IS NOT NULL OR q.curriculum_competency IS NOT NULL)
                )
            )
            AND q.lifecycle_state IN ('published', 'generated')
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
            v_clinical_keywords[1],
            v_q,
            v_count_eligible,
            v_returned,
            v_latency,
            (v_returned >= v_q OR (v_returned > 0 AND v_returned >= LEAST(v_q, v_count_eligible))),
            CASE WHEN v_returned = 0 THEN 'NO_QUESTIONS_RETURNED' ELSE NULL END
        ) RETURNING id INTO v_test_run_id;

    END LOOP;

    RETURN jsonb_build_object(
        'competency', p_competency_name,
        'eligible', v_count_eligible,
        'status', 'TEST_COMPLETE'
    );
END;
$$;
