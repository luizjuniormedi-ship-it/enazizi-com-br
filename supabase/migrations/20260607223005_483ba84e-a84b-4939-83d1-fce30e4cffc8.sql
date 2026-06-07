CREATE OR REPLACE FUNCTION public.fn_cvrp_reconstruct_links()
RETURNS TABLE (
    total_processed INT,
    total_resolved INT,
    total_failed INT
) LANGUAGE plpgsql AS $$
DECLARE
    q_rec RECORD;
    resolved_topic_id UUID;
    resolved_comp_id UUID;
    v_processed INT := 0;
    v_resolved INT := 0;
    v_failed INT := 0;
    v_search_text TEXT;
    v_comp_name TEXT;
    v_topic_name TEXT;
BEGIN
    FOR q_rec IN (
        SELECT id, topic, subtopic, statement 
        FROM public.questions_bank 
        WHERE (topic_id IS NULL OR competency_id IS NULL OR curriculum_competency IS NULL)
        AND lifecycle_state != 'archived'
    ) LOOP
        v_processed := v_processed + 1;
        resolved_topic_id := NULL;
        resolved_comp_id := NULL;
        v_search_text := lower(COALESCE(q_rec.topic, '') || ' ' || COALESCE(q_rec.subtopic, '') || ' ' || LEFT(q_rec.statement, 200));

        -- 1. Try Keyword Matching for P0 Topics
        IF v_search_text ~ '(iam|infarto|miocárdio|coronariana|angina)' THEN
            SELECT id INTO resolved_comp_id FROM public.curriculum_registry WHERE curriculum_competency = 'Síndrome Coronariana Aguda' LIMIT 1;
        ELSIF v_search_text ~ '(sepse|sepsis|choque séptico)' THEN
            SELECT id INTO resolved_comp_id FROM public.curriculum_registry WHERE curriculum_competency = 'Sepse e Choque Séptico' LIMIT 1;
        ELSIF v_search_text ~ '(avc|derrame|ictus|isquêmico|hemorrágico)' THEN
            SELECT id INTO resolved_comp_id FROM public.curriculum_registry WHERE curriculum_competency = 'AVC' LIMIT 1;
        ELSIF v_search_text ~ '(cetoacidose|cad)' THEN
            SELECT id INTO resolved_comp_id FROM public.curriculum_registry WHERE curriculum_competency = 'Diabetes Mellitus' LIMIT 1;
        ELSIF v_search_text ~ '(tep|embolia pulmonar)' THEN
            SELECT id INTO resolved_comp_id FROM public.curriculum_registry WHERE curriculum_competency = 'Tromboembolismo Pulmonar' LIMIT 1;
        ELSIF v_search_text ~ '(insuficiência cardíaca|ic|icp|ic aguda)' THEN
            SELECT id INTO resolved_comp_id FROM public.curriculum_registry WHERE curriculum_competency = 'Insuficiência Cardíaca' LIMIT 1;
        END IF;

        -- 2. Alias resolution
        IF resolved_comp_id IS NULL THEN
            SELECT competency_id::uuid INTO resolved_comp_id 
            FROM public.competency_aliases 
            WHERE q_rec.topic ILIKE '%' || alias || '%' 
            OR q_rec.subtopic ILIKE '%' || alias || '%'
            LIMIT 1;
        END IF;

        -- 3. Resolve topic_id
        IF resolved_comp_id IS NOT NULL THEN
            SELECT id INTO resolved_topic_id 
            FROM public.curriculum_topics 
            WHERE lower(nome) = (SELECT lower(curriculum_competency) FROM public.curriculum_registry WHERE id = resolved_comp_id)
            LIMIT 1;
            
            IF resolved_topic_id IS NULL THEN
                 SELECT id INTO resolved_topic_id 
                 FROM public.curriculum_topics 
                 WHERE specialty_id = (SELECT specialty_id FROM public.curriculum_specialties WHERE nome = (SELECT specialty FROM public.curriculum_registry WHERE id = resolved_comp_id) LIMIT 1)
                 LIMIT 1;
            END IF;
        END IF;

        -- 4. Final Fallback
        IF resolved_topic_id IS NULL THEN
            SELECT id INTO resolved_topic_id FROM public.curriculum_topics WHERE lower(nome) = lower(q_rec.topic) LIMIT 1;
        END IF;

        IF resolved_topic_id IS NOT NULL OR resolved_comp_id IS NOT NULL THEN
            -- Get canonical names for sync
            SELECT curriculum_competency INTO v_comp_name FROM public.curriculum_registry WHERE id = resolved_comp_id;
            SELECT nome INTO v_topic_name FROM public.curriculum_topics WHERE id = resolved_topic_id;

            UPDATE public.questions_bank 
            SET 
                topic_id = COALESCE(resolved_topic_id, topic_id),
                competency_id = COALESCE(resolved_comp_id, competency_id),
                curriculum_competency = COALESCE(v_comp_name, curriculum_competency),
                curriculum_theme = COALESCE(v_topic_name, curriculum_theme),
                updated_at = now()
            WHERE id = q_rec.id;

            INSERT INTO public.cvrp_orphan_reconstruction_log (
                question_id, new_topic_id, new_competency_id, match_method, match_confidence
            ) VALUES (
                q_rec.id, resolved_topic_id, resolved_comp_id, 'pattern_matching_with_sync', 0.90
            );
            
            v_resolved := v_resolved + 1;
        ELSE
            v_failed := v_failed + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_resolved, v_failed;
END;
$$;