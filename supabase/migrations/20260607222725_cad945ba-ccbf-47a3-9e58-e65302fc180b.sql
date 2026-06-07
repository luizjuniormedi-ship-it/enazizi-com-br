-- ENAZIZI GOLD: P0 PERMANENT TOPIC LINK RESOLUTION (CVRP)

-- 1. DROP DEPENDENT VIEWS
DROP VIEW IF EXISTS public.ghost_competency_registry;
DROP VIEW IF EXISTS public.cvrp_specialty_stats;
DROP VIEW IF EXISTS public.cvrp_ghost_competencies;

-- 2. ALTER COLUMN AND ADD FK
ALTER TABLE public.questions_bank 
ALTER COLUMN competency_id TYPE UUID USING competency_id::uuid;

-- Add FK for data integrity (Phase 4)
ALTER TABLE public.questions_bank
ADD CONSTRAINT fk_questions_bank_competency_registry
FOREIGN KEY (competency_id) REFERENCES public.curriculum_registry(id)
ON DELETE SET NULL;

ALTER TABLE public.questions_bank
ADD CONSTRAINT fk_questions_bank_curriculum_topic
FOREIGN KEY (topic_id) REFERENCES public.curriculum_topics(id)
ON DELETE SET NULL;

-- 3. RECREATE VIEWS
CREATE OR REPLACE VIEW public.ghost_competency_registry AS
 WITH physical_stats AS (
         SELECT questions_bank.topic AS legacy_topic,
            questions_bank.subtopic AS legacy_subtopic,
            count(*) AS physical_count
           FROM questions_bank
          GROUP BY questions_bank.topic, questions_bank.subtopic
        ), mapping_stats AS (
         SELECT cr_1.id AS competency_id,
            cr_1.curriculum_competency AS competency_name,
            count(qb.id) AS visible_count
           FROM curriculum_registry cr_1
             LEFT JOIN questions_bank qb ON qb.competency_id = cr_1.id
          GROUP BY cr_1.id, cr_1.curriculum_competency
        )
 SELECT cr.id AS competency_id,
    cr.curriculum_competency AS competency_name,
    COALESCE(ps.physical_count, (0)::bigint) AS physical_questions,
    COALESCE(ms.visible_count, (0)::bigint) AS visible_questions,
        CASE
            WHEN (COALESCE(ps.physical_count, (0)::bigint) > 0) THEN (((COALESCE(ms.visible_count, (0)::bigint))::double precision / (ps.physical_count)::double precision) * (100)::double precision)
            ELSE (100)::double precision
        END AS visibility_ratio
   FROM ((curriculum_registry cr
     LEFT JOIN mapping_stats ms ON ((ms.competency_id = cr.id)))
     LEFT JOIN physical_stats ps ON ((ps.legacy_topic = cr.curriculum_competency)));

CREATE OR REPLACE VIEW public.cvrp_specialty_stats AS
 WITH physical_counts AS (
         SELECT COALESCE(questions_bank.curriculum_discipline, questions_bank.topic, 'N/A'::text) AS specialty,
            count(*) AS physical_count
           FROM questions_bank
          GROUP BY COALESCE(questions_bank.curriculum_discipline, questions_bank.topic, 'N/A'::text)
        ), visible_counts AS (
         SELECT COALESCE(q.curriculum_discipline, q.topic, 'N/A'::text) AS specialty,
            count(*) AS visible_count
           FROM (questions_bank q
             JOIN legacy_to_curriculum_map m ON ((((q.id)::text = m.legacy_string) OR (q.competency_id = m.competency_id))))
          GROUP BY COALESCE(q.curriculum_discipline, q.topic, 'N/A'::text)
        )
 SELECT p.specialty,
    p.physical_count,
    COALESCE(v.visible_count, (0)::bigint) AS visible_count,
    (p.physical_count - COALESCE(v.visible_count, (0)::bigint)) AS lost_count,
        CASE
            WHEN (p.physical_count = 0) THEN (0)::numeric
            ELSE round((((COALESCE(v.visible_count, (0)::bigint))::numeric / (p.physical_count)::numeric) * (100)::numeric), 2)
        END AS ocr_percentage,
        CASE
            WHEN (((COALESCE(v.visible_count, (0)::bigint))::numeric / (NULLIF(p.physical_count, 0))::numeric) < 0.25) THEN 'CRITICAL'::text
            WHEN (((COALESCE(v.visible_count, (0)::bigint))::numeric / (NULLIF(p.physical_count, 0))::numeric) < 0.50) THEN 'POOR'::text
            WHEN (((COALESCE(v.visible_count, (0)::bigint))::numeric / (NULLIF(p.physical_count, 0))::numeric) < 0.80) THEN 'PARTIAL'::text
            ELSE 'OPERATIONAL'::text
        END AS status
   FROM (physical_counts p
     LEFT JOIN visible_counts v ON ((p.specialty = v.specialty)))
  WHERE (p.specialty IS NOT NULL);

CREATE OR REPLACE VIEW public.cvrp_ghost_competencies AS
 SELECT COALESCE(q.curriculum_competency, q.topic, 'N/A'::text) AS competency,
    COALESCE(q.curriculum_discipline, 'N/A'::text) AS specialty,
    count(*) AS physical_count,
    'MISSING_MAPPING'::text AS root_cause
   FROM (questions_bank q
     LEFT JOIN legacy_to_curriculum_map m ON ((((q.id)::text = m.legacy_string) OR (q.competency_id = m.competency_id))))
  WHERE (m.id IS NULL)
  GROUP BY COALESCE(q.curriculum_competency, q.topic, 'N/A'::text), COALESCE(q.curriculum_discipline, 'N/A'::text);

-- 4. CREATE CVRP TABLES
CREATE TABLE IF NOT EXISTS public.cvrp_topic_link_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions_bank(id),
    has_topic_id BOOLEAN NOT NULL,
    has_competency_id BOOLEAN NOT NULL,
    is_topic_valid BOOLEAN NOT NULL,
    is_competency_valid BOOLEAN NOT NULL,
    specialty_consistency BOOLEAN NOT NULL,
    orphan_reason TEXT,
    last_audit_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cvrp_topic_link_audit TO authenticated;
GRANT ALL ON public.cvrp_topic_link_audit TO service_role;
ALTER TABLE public.cvrp_topic_link_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read audit" ON public.cvrp_topic_link_audit FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.cvrp_orphan_reconstruction_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions_bank(id),
    previous_topic_id UUID,
    new_topic_id UUID,
    previous_competency_id UUID,
    new_competency_id UUID,
    match_method TEXT,
    match_confidence NUMERIC(5,2),
    source_metadata TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cvrp_orphan_reconstruction_log TO authenticated;
GRANT ALL ON public.cvrp_orphan_reconstruction_log TO service_role;
ALTER TABLE public.cvrp_orphan_reconstruction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read reconstruction logs" ON public.cvrp_orphan_reconstruction_log FOR SELECT USING (true);

-- 5. ENGINE FUNCTION
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
BEGIN
    FOR q_rec IN (
        SELECT id, topic, subtopic, statement 
        FROM public.questions_bank 
        WHERE (topic_id IS NULL OR competency_id IS NULL)
        AND lifecycle_state != 'archived'
    ) LOOP
        v_processed := v_processed + 1;
        resolved_topic_id := NULL;
        resolved_comp_id := NULL;

        -- 1. Try exact match on topic name
        SELECT id INTO resolved_topic_id FROM public.curriculum_topics WHERE lower(nome) = lower(q_rec.topic) LIMIT 1;
        
        -- 2. Try alias resolution
        IF resolved_topic_id IS NULL THEN
            SELECT competency_id::uuid INTO resolved_comp_id 
            FROM public.competency_aliases 
            WHERE lower(alias) = lower(q_rec.topic) 
            LIMIT 1;
            
            IF resolved_comp_id IS NOT NULL THEN
                SELECT id INTO resolved_topic_id 
                FROM public.curriculum_topics 
                WHERE lower(nome) = (SELECT lower(curriculum_competency) FROM public.curriculum_registry WHERE id = resolved_comp_id)
                LIMIT 1;
            END IF;
        END IF;

        -- 3. Resolve competency from topic if missing
        IF resolved_comp_id IS NULL AND resolved_topic_id IS NOT NULL THEN
            SELECT id INTO resolved_comp_id 
            FROM public.curriculum_registry 
            WHERE lower(curriculum_competency) = (SELECT lower(nome) FROM public.curriculum_topics WHERE id = resolved_topic_id)
            LIMIT 1;
        END IF;

        IF resolved_topic_id IS NOT NULL OR resolved_comp_id IS NOT NULL THEN
            UPDATE public.questions_bank 
            SET 
                topic_id = COALESCE(resolved_topic_id, topic_id),
                competency_id = COALESCE(resolved_comp_id, competency_id),
                updated_at = now()
            WHERE id = q_rec.id;

            INSERT INTO public.cvrp_orphan_reconstruction_log (
                question_id, new_topic_id, new_competency_id, match_method, match_confidence
            ) VALUES (
                q_rec.id, resolved_topic_id, resolved_comp_id, 'auto_reconstruction', 1.0
            );
            
            v_resolved := v_resolved + 1;
        ELSE
            v_failed := v_failed + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_resolved, v_failed;
END;
$$;

-- 6. TRIGGER AND MONITORING
CREATE OR REPLACE FUNCTION public.fn_cvrp_prevent_orphan_publication()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.lifecycle_state = 'published' AND (NEW.topic_id IS NULL OR NEW.competency_id IS NULL) THEN
        RAISE EXCEPTION 'CVRP_VIOLATION: Cannot publish question without valid topic_id and competency_id (Question ID: %)', NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cvrp_prevent_orphan_publication ON public.questions_bank;
CREATE TRIGGER trg_cvrp_prevent_orphan_publication
BEFORE INSERT OR UPDATE ON public.questions_bank
FOR EACH ROW EXECUTE FUNCTION public.fn_cvrp_prevent_orphan_publication();

CREATE OR REPLACE VIEW public.v_cvrp_topic_link_health AS
SELECT 
    COUNT(*) as total_questions,
    COUNT(*) FILTER (WHERE topic_id IS NOT NULL) as linked_questions,
    COUNT(*) FILTER (WHERE topic_id IS NULL) as orphan_questions,
    ROUND((COUNT(*) FILTER (WHERE topic_id IS NOT NULL))::numeric / GREATEST(COUNT(*), 1) * 100, 2) as topic_link_rate,
    COUNT(*) FILTER (WHERE competency_id IS NOT NULL) as competency_linked_questions,
    ROUND((COUNT(*) FILTER (WHERE competency_id IS NOT NULL))::numeric / GREATEST(COUNT(*), 1) * 100, 2) as competency_link_rate
FROM public.questions_bank
WHERE lifecycle_state = 'published';

CREATE OR REPLACE VIEW public.v_cvrp_operational_certification AS
SELECT 
    cr.curriculum_competency as competency_name,
    COUNT(qb.id) as physical_questions,
    COUNT(qb.id) FILTER (WHERE qb.lifecycle_state = 'published' AND qb.topic_id IS NOT NULL) as usable_questions,
    CASE 
        WHEN COUNT(qb.id) = 0 THEN 0 
        ELSE ROUND((COUNT(qb.id) FILTER (WHERE qb.lifecycle_state = 'published' AND qb.topic_id IS NOT NULL))::numeric / COUNT(qb.id) * 100, 2) 
    END as usability_rate
FROM public.curriculum_registry cr
LEFT JOIN public.questions_bank qb ON qb.competency_id = cr.id
GROUP BY cr.curriculum_competency
ORDER BY usability_rate ASC;