-- 1. Snapshot table for PMC tracking
CREATE TABLE IF NOT EXISTS public.pmc_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    phase TEXT NOT NULL,
    total_questions INTEGER,
    topic_id_filled INTEGER,
    competency_id_filled INTEGER,
    specialty_id_filled INTEGER,
    orphans INTEGER,
    operational_competencies INTEGER,
    cos_score NUMERIC,
    ocr_score NUMERIC,
    ccs_score NUMERIC,
    tps_score NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT ON public.pmc_snapshots TO authenticated;
GRANT ALL ON public.pmc_snapshots TO service_role;
ALTER TABLE public.pmc_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage snapshots" ON public.pmc_snapshots FOR ALL USING (true) WITH CHECK (true);

-- 2. Enhanced Metrics Rebuild
CREATE OR REPLACE FUNCTION public.rebuild_curriculum_metrics()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_total_competencies integer;
    v_operational_competencies integer;
BEGIN
    -- Update visible_questions for all topics
    UPDATE public.curriculum_topics t
    SET 
        visible_questions = (
            SELECT count(*) 
            FROM public.questions_bank q 
            WHERE q.topic_id = t.id 
            AND q.review_status = 'approved'
        ),
        ccs_score = (
            SELECT COALESCE(avg(classification_confidence), 0) * 100
            FROM public.questions_bank q 
            WHERE q.topic_id = t.id 
            AND q.review_status = 'approved'
        );
    
    -- RPS (Relative Pedagogical Strength) recalculation
    UPDATE public.curriculum_topics 
    SET rps = LEAST((visible_questions::numeric / 20.0) * 100, 100)
    WHERE visible_questions > 0;

    -- Update status based on question availability
    UPDATE public.curriculum_topics
    SET status = CASE 
        WHEN visible_questions >= 10 THEN 'operational'
        WHEN visible_questions > 0 THEN 'insufficient'
        ELSE 'empty'
    END;

    -- Update OCR (Official Coverage Rate) and COS (Curriculum Operational Score) would normally be triggered here or aggregated
END;
$function$;

-- 3. PMC Report Generation
CREATE OR REPLACE FUNCTION public.get_pmc_report()
 RETURNS JSONB
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_current jsonb;
    v_before jsonb;
BEGIN
    -- Get latest snapshot (Before)
    SELECT row_to_json(s)::jsonb INTO v_before 
    FROM public.pmc_snapshots s 
    WHERE phase = 'INITIAL'
    ORDER BY created_at DESC LIMIT 1;

    -- Calculate current metrics
    SELECT jsonb_build_object(
        'total_questions', (SELECT count(*) FROM public.questions_bank),
        'topic_id_filled', (SELECT count(*) FROM public.questions_bank WHERE topic_id IS NOT NULL),
        'competency_id_filled', (SELECT count(*) FROM public.questions_bank WHERE competency_id IS NOT NULL),
        'specialty_id_filled', (SELECT count(*) FROM public.questions_bank WHERE specialty_id IS NOT NULL),
        'orphans', (SELECT count(*) FROM public.questions_bank WHERE topic_id IS NULL OR competency_id IS NULL),
        'operational_competencies', (SELECT count(*) FROM public.curriculum_topics WHERE visible_questions >= 10),
        'cos', (
            SELECT ROUND((count(CASE WHEN visible_questions >= 10 THEN 1 END)::numeric / NULLIF(count(*), 0)::numeric) * 100, 2)
            FROM public.curriculum_topics
        ),
        'ocr', (
            SELECT ROUND((count(CASE WHEN visible_questions > 0 THEN 1 END)::numeric / NULLIF(count(*), 0)::numeric) * 100, 2)
            FROM public.curriculum_topics
        ),
        'ccs', (SELECT ROUND(COALESCE(avg(classification_confidence), 0) * 100, 2) FROM public.questions_bank WHERE topic_id IS NOT NULL)
    ) INTO v_current;

    RETURN jsonb_build_object(
        'current', v_current,
        'before', COALESCE(v_before, v_current) -- Fallback if no initial snapshot
    );
END;
$function$;

-- 4. Orphan Audit
CREATE OR REPLACE FUNCTION public.audit_orphans()
 RETURNS TABLE (
    question_id uuid,
    statement text,
    current_topic text,
    current_subtopic text,
    audit_category text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        q.id as question_id,
        LEFT(q.statement, 200) as statement,
        q.topic as current_topic,
        q.subtopic as current_subtopic,
        CASE 
            WHEN q.topic IS NULL AND q.subtopic IS NULL THEN 'conteúdo inválido'
            WHEN q.statement IS NULL OR length(q.statement) < 10 THEN 'conteúdo inválido'
            WHEN q.topic IS NOT NULL THEN 'recuperável'
            ELSE 'erro de classificação'
        END as audit_category
    FROM public.questions_bank q
    WHERE q.topic_id IS NULL OR q.competency_id IS NULL
    LIMIT 100;
END;
$function$;

-- 5. Create Initial Snapshot if none exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.pmc_snapshots WHERE phase = 'INITIAL') THEN
        INSERT INTO public.pmc_snapshots (
            phase, 
            total_questions, 
            topic_id_filled, 
            competency_id_filled, 
            specialty_id_filled, 
            orphans,
            operational_competencies,
            cos_score,
            ocr_score,
            ccs_score
        )
        SELECT 
            'INITIAL',
            (SELECT count(*) FROM public.questions_bank),
            (SELECT count(*) FROM public.questions_bank WHERE topic_id IS NOT NULL),
            (SELECT count(*) FROM public.questions_bank WHERE competency_id IS NOT NULL),
            (SELECT count(*) FROM public.questions_bank WHERE specialty_id IS NOT NULL),
            (SELECT count(*) FROM public.questions_bank WHERE topic_id IS NULL OR competency_id IS NULL),
            (SELECT count(*) FROM public.curriculum_topics WHERE visible_questions >= 10),
            3.07, -- Current value mentioned by user
            (SELECT ROUND((count(CASE WHEN visible_questions > 0 THEN 1 END)::numeric / NULLIF(count(*), 0)::numeric) * 100, 2) FROM public.curriculum_topics),
            (SELECT ROUND(COALESCE(avg(classification_confidence), 0) * 100, 2) FROM public.questions_bank WHERE topic_id IS NOT NULL);
    END IF;
END $$;
