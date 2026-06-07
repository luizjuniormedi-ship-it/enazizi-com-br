-- Drop previous versions to ensure fresh start with correct schema
DROP VIEW IF EXISTS public.ugrp_moc_report;
DROP FUNCTION IF EXISTS public.audit_question_funnel(TEXT);

-- 1. Create the Funnel Audit Table (Ensure column types match questions_bank)
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

-- 2. Function to Audit Funnel for Critical Topics
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
    -- Get Topic ID (using 'nome' column)
    SELECT id INTO t_id FROM public.curriculum_topics WHERE nome = target_topic_name LIMIT 1;
    
    IF t_id IS NULL THEN
        -- Try exact match or partial match for robustness
        SELECT id INTO t_id FROM public.curriculum_topics WHERE nome ILIKE '%' || target_topic_name || '%' LIMIT 1;
    END IF;

    IF t_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Topic not found: ' || target_topic_name);
    END IF;

    -- Phase 1: Physical (All records in the bank mapped to this topic_id)
    SELECT count(*) INTO p_count FROM public.questions_bank q
    WHERE q.topic_id = t_id;

    -- Phase 2: Mapped (Explicitly mapped - in our schema, presence of topic_id IS the mapping)
    m_count := p_count; 

    -- Phase 3: Published (review_status = 'approved' or similar)
    -- Based on columns, 'review_status' or 'approved_for_generation' are the keys
    SELECT count(*) INTO pub_count FROM public.questions_bank q
    WHERE q.topic_id = t_id AND q.review_status = 'approved';

    -- Phase 4: Unique (Deduplicated via statement or embedding_hash)
    SELECT count(DISTINCT q.statement) INTO u_count FROM public.questions_bank q
    WHERE q.topic_id = t_id AND q.review_status = 'approved';

    -- Phase 5: Eligible (approved_for_generation = true)
    SELECT count(*) INTO e_count FROM public.questions_bank q
    WHERE q.topic_id = t_id 
    AND q.review_status = 'approved'
    AND q.approved_for_generation = true;

    -- Phase 6: Selectable (Final quality check)
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
