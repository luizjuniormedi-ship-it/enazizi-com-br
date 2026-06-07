CREATE OR REPLACE FUNCTION public.audit_question_funnel(target_topic_name TEXT)
RETURNS JSONB AS $$
DECLARE
    t_id UUID;
    keyword TEXT;
    p_count INT; -- Physical pool (Keyword matches + topic_id matches)
    m_count INT; -- Mapped (topic_id exists)
    pub_count INT;
    u_count INT;
    e_count INT;
    s_count INT;
    result JSONB;
BEGIN
    -- Get Topic ID
    SELECT id INTO t_id FROM public.curriculum_topics WHERE nome = target_topic_name LIMIT 1;
    
    IF t_id IS NULL THEN
        SELECT id INTO t_id FROM public.curriculum_topics WHERE nome ILIKE '%' || target_topic_name || '%' LIMIT 1;
    END IF;

    IF t_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Topic not found: ' || target_topic_name);
    END IF;

    -- Define search keyword based on topic name
    keyword := CASE 
        WHEN target_topic_name = 'Síndrome Coronariana Aguda' THEN 'infarto'
        WHEN target_topic_name = 'Sepse e Choque Séptico' THEN 'sepse'
        WHEN target_topic_name = 'AVC' THEN 'acidente vascular cerebral'
        ELSE target_topic_name
    END;

    -- Phase 1: Physical (Keyword matches OR topic_id matches)
    SELECT count(*) INTO p_count FROM public.questions_bank q
    WHERE q.topic_id = t_id OR q.statement ILIKE '%' || keyword || '%';

    -- Phase 2: Mapped (Topic ID explicitly set)
    SELECT count(*) INTO m_count FROM public.questions_bank q
    WHERE q.topic_id = t_id; 

    -- Phase 3: Published (review_status = 'approved')
    SELECT count(*) INTO pub_count FROM public.questions_bank q
    WHERE q.topic_id = t_id AND q.review_status = 'approved';

    -- Phase 4: Unique
    SELECT count(DISTINCT q.statement) INTO u_count FROM public.questions_bank q
    WHERE q.topic_id = t_id AND q.review_status = 'approved';

    -- Phase 5: Eligible
    SELECT count(*) INTO e_count FROM public.questions_bank q
    WHERE q.topic_id = t_id 
    AND q.review_status = 'approved'
    AND q.approved_for_generation = true;

    -- Phase 6: Selectable
    SELECT count(*) INTO s_count FROM public.questions_bank q
    WHERE q.topic_id = t_id 
    AND q.review_status = 'approved'
    AND q.approved_for_generation = true
    AND (q.cognitive_quality_score >= 0.5 OR q.cognitive_quality_score IS NULL);

    -- Insert into Funnel Audit
    INSERT INTO public.ugrp_question_funnel 
    (topic_id, topic_name, physical_count, mapped_count, published_count, unique_count, eligible_count, selectable_count)
    VALUES (t_id, target_topic_name, p_count, m_count, pub_count, u_count, e_count, s_count);

    result := jsonb_build_object(
        'topic', target_topic_name,
        'keyword', keyword,
        'funnel', jsonb_build_object(
            'physical_potential', p_count,
            'explicitly_mapped', m_count,
            'published_approved', pub_count,
            'unique_statement', u_count,
            'eligible_for_gen', e_count,
            'selectable_quality', s_count
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
