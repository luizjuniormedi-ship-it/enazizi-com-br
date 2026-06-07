-- FCCP PHASE 6: CURRICULUM MATURITY INFRASTRUCTURE

-- 1. Maturity Ranking Table
CREATE TABLE IF NOT EXISTS public.fccp_maturity_ranking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
    enare_incidence_score FLOAT DEFAULT 0, -- 0-100
    enamed_incidence_score FLOAT DEFAULT 0, -- 0-100
    search_frequency_score FLOAT DEFAULT 0, -- 0-100
    tutor_usage_score FLOAT DEFAULT 0, -- 0-100
    priority_index FLOAT GENERATED ALWAYS AS (
        (enare_incidence_score * 0.4) + 
        (enamed_incidence_score * 0.3) + 
        (search_frequency_score * 0.15) + 
        (tutor_usage_score * 0.15)
    ) STORED,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fccp_maturity_ranking TO authenticated;
GRANT ALL ON public.fccp_maturity_ranking TO service_role;
ALTER TABLE public.fccp_maturity_ranking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System management for maturity ranking" ON public.fccp_maturity_ranking FOR ALL USING (true);

-- 2. Targeted Recovery Queue
CREATE TABLE IF NOT EXISTS public.fccp_targeted_recovery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id),
    status TEXT CHECK (status IN ('PENDING', 'RECOVERING', 'GENERATING', 'COMPLETED', 'FAILED')),
    gap_count INTEGER,
    recovery_source TEXT, -- 'ORPHAN', 'ARCHIVED', 'LEGACY', 'NEW_GENERATION'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fccp_targeted_recovery_queue TO authenticated;
GRANT ALL ON public.fccp_targeted_recovery_queue TO service_role;
ALTER TABLE public.fccp_targeted_recovery_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System management for recovery queue" ON public.fccp_targeted_recovery_queue FOR ALL USING (true);

-- 3. CCS History Tracking
CREATE TABLE IF NOT EXISTS public.fccp_ccs_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ccs_global FLOAT NOT NULL,
    total_topics INTEGER,
    critical_topics INTEGER,
    limited_topics INTEGER,
    operational_topics INTEGER,
    snapshot_date DATE DEFAULT CURRENT_DATE UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fccp_ccs_history TO authenticated;
GRANT ALL ON public.fccp_ccs_history TO service_role;
ALTER TABLE public.fccp_ccs_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for CCS history" ON public.fccp_ccs_history FOR SELECT USING (true);

-- 4. Quality Gate Enhancement
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS topic_integrity_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS enare_fidelity_score FLOAT DEFAULT 0;

-- 5. Operational View: Specialty Certification
CREATE OR REPLACE VIEW public.v_fccp_specialty_certification AS
WITH topic_stats AS (
    SELECT 
        s.id as specialty_id,
        s.nome as specialty_name,
        t.id as topic_id,
        COUNT(q.id) FILTER (WHERE q.lifecycle_state = 'published' OR q.review_status = 'approved') as eligible_count
    FROM public.curriculum_specialties s
    JOIN public.curriculum_topics t ON t.specialty_id = s.id
    LEFT JOIN public.questions_bank q ON q.topic_id = t.id
    GROUP BY s.id, s.nome, t.id
)
SELECT 
    specialty_id,
    specialty_name,
    COUNT(topic_id) as total_topics,
    COUNT(topic_id) FILTER (WHERE eligible_count < 20) as critical_count,
    COUNT(topic_id) FILTER (WHERE eligible_count >= 20 AND eligible_count < 50) as limited_count,
    COUNT(topic_id) FILTER (WHERE eligible_count >= 50) as operational_count,
    CASE 
        WHEN COUNT(topic_id) FILTER (WHERE eligible_count < 20) = 0 THEN 'CERTIFIED'
        ELSE 'PENDING'
    END as certification_status
FROM topic_stats
GROUP BY specialty_id, specialty_name;

-- 6. Core Function: Calculate Global CCS
CREATE OR REPLACE FUNCTION public.calculate_fccp_ccs()
RETURNS FLOAT AS $$
DECLARE
    total_t INTEGER;
    op_t INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_t FROM public.curriculum_topics;
    
    SELECT COUNT(t.id) INTO op_t
    FROM public.curriculum_topics t
    WHERE (
        SELECT COUNT(*) 
        FROM public.questions_bank q 
        WHERE q.topic_id = t.id AND (q.lifecycle_state = 'published' OR q.review_status = 'approved')
    ) >= 20;
    
    IF total_t = 0 THEN RETURN 0; END IF;
    RETURN (op_t::FLOAT / total_t::FLOAT) * 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Audit Trigger for Duplicate Shield
CREATE OR REPLACE FUNCTION public.fn_duplicate_shield_check()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.embedding_hash IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.questions_bank 
        WHERE embedding_hash = NEW.embedding_hash 
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'DUPLICATE_DETECTED: Question with identical content embedding already exists.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_duplicate_shield') THEN
        CREATE TRIGGER tr_duplicate_shield
        BEFORE INSERT OR UPDATE ON public.questions_bank
        FOR EACH ROW EXECUTE FUNCTION public.fn_duplicate_shield_check();
    END IF;
END $$;

-- 8. Refresh CCS History (Daily Snapshot)
CREATE OR REPLACE FUNCTION public.refresh_fccp_ccs_snapshot()
RETURNS void AS $$
BEGIN
    INSERT INTO public.fccp_ccs_history (
        ccs_global,
        total_topics,
        critical_topics,
        limited_topics,
        operational_topics
    )
    SELECT 
        public.calculate_fccp_ccs(),
        (SELECT COUNT(*) FROM public.curriculum_topics),
        (SELECT COUNT(*) FROM (
            SELECT t.id FROM public.curriculum_topics t
            LEFT JOIN public.questions_bank q ON q.topic_id = t.id
            GROUP BY t.id HAVING COUNT(q.id) FILTER (WHERE q.lifecycle_state = 'published' OR q.review_status = 'approved') < 20
        ) ts),
        (SELECT COUNT(*) FROM (
            SELECT t.id FROM public.curriculum_topics t
            LEFT JOIN public.questions_bank q ON q.topic_id = t.id
            GROUP BY t.id HAVING COUNT(q.id) FILTER (WHERE q.lifecycle_state = 'published' OR q.review_status = 'approved') >= 20 
                        AND COUNT(q.id) FILTER (WHERE q.lifecycle_state = 'published' OR q.review_status = 'approved') < 50
        ) ts),
        (SELECT COUNT(*) FROM (
            SELECT t.id FROM public.curriculum_topics t
            LEFT JOIN public.questions_bank q ON q.topic_id = t.id
            GROUP BY t.id HAVING COUNT(q.id) FILTER (WHERE q.lifecycle_state = 'published' OR q.review_status = 'approved') >= 50
        ) ts)
    ON CONFLICT (snapshot_date) DO UPDATE SET
        ccs_global = EXCLUDED.ccs_global,
        critical_topics = EXCLUDED.critical_topics,
        limited_topics = EXCLUDED.limited_topics,
        operational_topics = EXCLUDED.operational_topics;
END;
$$ LANGUAGE plpgsql;
