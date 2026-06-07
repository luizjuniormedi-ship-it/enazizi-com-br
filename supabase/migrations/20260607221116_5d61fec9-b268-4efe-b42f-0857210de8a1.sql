-- 1. Create the Funnel Audit Table
CREATE TABLE IF NOT EXISTS public.ugrp_question_funnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id),
    topic_name TEXT NOT NULL,
    physical_count INT DEFAULT 0,
    mapped_count INT DEFAULT 0,
    published_count INT DEFAULT 0,
    unique_count INT DEFAULT 0,
    eligible_count INT DEFAULT 0,
    selectable_count INT DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the Eligibility Loss Log
CREATE TABLE IF NOT EXISTS public.ugrp_eligibility_loss_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id),
    phase TEXT NOT NULL, -- 'publication', 'duplication', 'quality', 'eligibility'
    reason TEXT NOT NULL,
    impact_count INT DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 3. Function to Audit Funnel for Critical Topics
CREATE OR REPLACE FUNCTION public.audit_question_funnel(target_topic_name TEXT)
RETURNS JSONB AS $$
DECLARE
    t_id UUID;
    p_count INT;
    m_count INT;
    pub_count INT;
    u_count INT;
    e_count INT;
    s_count INT;
    result JSONB;
BEGIN
    -- Get Topic ID (using 'nome' column based on schema)
    SELECT id INTO t_id FROM public.curriculum_topics WHERE nome = target_topic_name LIMIT 1;
    
    IF t_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Topic not found: ' || target_topic_name);
    END IF;

    -- Phase 1: Physical
    SELECT count(*) INTO p_count FROM public.questions_bank q
    JOIN public.legacy_to_curriculum_map m ON q.id = m.question_id
    WHERE m.topic_id = t_id;

    -- Phase 2: Mapped
    m_count := p_count; 

    -- Phase 3: Published
    SELECT count(*) INTO pub_count FROM public.questions_bank q
    JOIN public.legacy_to_curriculum_map m ON q.id = m.question_id
    WHERE m.topic_id = t_id AND q.status = 'published';

    -- Phase 4: Unique (Deduplicated)
    BEGIN
        SELECT count(DISTINCT q.content_hash) INTO u_count FROM public.questions_bank q
        JOIN public.legacy_to_curriculum_map m ON q.id = m.question_id
        WHERE m.topic_id = t_id AND q.status = 'published';
    EXCEPTION WHEN OTHERS THEN
        SELECT count(DISTINCT q.enunciado) INTO u_count FROM public.questions_bank q
        JOIN public.legacy_to_curriculum_map m ON q.id = m.question_id
        WHERE m.topic_id = t_id AND q.status = 'published';
    END;

    -- Phase 5: Eligible
    SELECT count(*) INTO e_count FROM public.questions_bank q
    JOIN public.legacy_to_curriculum_map m ON q.id = m.question_id
    WHERE m.topic_id = t_id 
    AND q.status = 'published'
    AND (q.metadata->>'quality_status' != 'low' OR q.metadata->>'quality_status' IS NULL);

    -- Phase 6: Selectable
    s_count := e_count;

    -- Insert into Funnel Audit
    INSERT INTO public.ugrp_question_funnel 
    (topic_id, topic_name, physical_count, mapped_count, published_count, unique_count, eligible_count, selectable_count)
    VALUES (t_id, target_topic_name, p_count, m_count, pub_count, u_count, e_count, s_count);

    result := jsonb_build_object(
        'topic', target_topic_name,
        'funnel', jsonb_build_object(
            'physical', p_count,
            'mapped', m_count,
            'published', pub_count,
            'unique', u_count,
            'eligible', e_count,
            'selectable', s_count
        )
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Minimum Operational Coverage (MOC) View
CREATE OR REPLACE VIEW public.ugrp_moc_report AS
WITH latest_funnel AS (
    SELECT DISTINCT ON (topic_id) *
    FROM public.ugrp_question_funnel
    ORDER BY topic_id, timestamp DESC
)
SELECT 
    topic_name,
    selectable_count as selectable,
    CASE 
        WHEN selectable_count < 20 THEN 'CRITICAL'
        WHEN selectable_count BETWEEN 20 AND 50 THEN 'INSUFFICIENT'
        WHEN selectable_count BETWEEN 50 AND 100 THEN 'LIMITED'
        ELSE 'OPERATIONAL'
    END as status,
    selectable_count as max_simulado
FROM latest_funnel;

-- 5. Permissions
GRANT ALL ON public.ugrp_question_funnel TO authenticated;
GRANT ALL ON public.ugrp_question_funnel TO service_role;
GRANT ALL ON public.ugrp_eligibility_loss_log TO authenticated;
GRANT ALL ON public.ugrp_eligibility_loss_log TO service_role;
GRANT SELECT ON public.ugrp_moc_report TO authenticated;
GRANT SELECT ON public.ugrp_moc_report TO service_role;
