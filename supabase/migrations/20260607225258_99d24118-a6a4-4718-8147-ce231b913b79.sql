-- FCCP Phase 6.1: Content Recovery First

-- 1. Create audit table
CREATE TABLE IF NOT EXISTS public.fccp_content_recovery_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID REFERENCES public.curriculum_topics(id),
    topic_name TEXT,
    visible_questions INTEGER DEFAULT 0,
    orphans_recoverable INTEGER DEFAULT 0,
    legacy_recoverable INTEGER DEFAULT 0,
    archived_recoverable INTEGER DEFAULT 0,
    quarantined_recoverable INTEGER DEFAULT 0,
    unclassified_recoverable INTEGER DEFAULT 0,
    total_recoverable INTEGER DEFAULT 0,
    operational_deficit INTEGER DEFAULT 0,
    rps_score NUMERIC(5,2) DEFAULT 0.00,
    classification TEXT, -- 'RECOVERY ONLY', 'RECOVERY FIRST', 'TARGETED GENERATION'
    last_audit_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fccp_content_recovery_audit TO authenticated;
GRANT ALL ON public.fccp_content_recovery_audit TO service_role;
ALTER TABLE public.fccp_content_recovery_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read for authenticated" ON public.fccp_content_recovery_audit FOR SELECT USING (true);

-- 2. Function to calculate RPS for a topic
CREATE OR REPLACE FUNCTION public.fccp_refresh_recovery_audit(p_topic_id UUID)
RETURNS void AS $$
DECLARE
    v_topic_name TEXT;
    v_visible INTEGER;
    v_orphans INTEGER;
    v_legacy INTEGER;
    v_archived INTEGER;
    v_quarantined INTEGER;
    v_unclassified INTEGER;
    v_total_rec INTEGER;
    v_deficit INTEGER;
    v_rps NUMERIC;
    v_classification TEXT;
    v_target INTEGER := 50; -- Operational target
BEGIN
    SELECT name INTO v_topic_name FROM public.curriculum_topics WHERE id = p_topic_id;
    
    -- Visible: Published and approved
    SELECT COUNT(*) INTO v_visible 
    FROM public.questions_bank 
    WHERE topic_id = p_topic_id 
    AND lifecycle_state = 'published' 
    AND approved_for_generation = true;

    -- Orphans: Mention topic name but not linked
    SELECT COUNT(*) INTO v_orphans 
    FROM public.questions_bank 
    WHERE topic_id IS NULL 
    AND (statement ILIKE '%' || v_topic_name || '%' OR topic ILIKE '%' || v_topic_name || '%');

    -- Legacy: Old ingestion versions or explicit legacy state
    SELECT COUNT(*) INTO v_legacy 
    FROM public.questions_bank 
    WHERE topic_id = p_topic_id 
    AND (lifecycle_state = 'legacy' OR ingestion_version < '2.0');

    -- Archived
    SELECT COUNT(*) INTO v_archived 
    FROM public.questions_bank 
    WHERE topic_id = p_topic_id 
    AND lifecycle_state = 'archived';

    -- Quarantined
    SELECT COUNT(*) INTO v_quarantined 
    FROM public.questions_bank 
    WHERE topic_id = p_topic_id 
    AND lifecycle_state = 'quarantined';

    -- Unclassified
    SELECT COUNT(*) INTO v_unclassified 
    FROM public.questions_bank 
    WHERE topic_id = p_topic_id 
    AND lifecycle_state = 'unclassified';

    v_total_rec := v_orphans + v_legacy + v_archived + v_quarantined + v_unclassified;
    v_deficit := GREATEST(0, v_target - v_visible);
    
    IF v_deficit = 0 THEN
        v_rps := 100.00;
    ELSE
        v_rps := ROUND((v_total_rec::NUMERIC / v_deficit::NUMERIC) * 100, 2);
    END IF;

    IF v_rps >= 100 THEN
        v_classification := 'RECOVERY ONLY';
    ELSIF v_rps >= 50 THEN
        v_classification := 'RECOVERY FIRST';
    ELSE
        v_classification := 'TARGETED GENERATION REQUIRED';
    END IF;

    INSERT INTO public.fccp_content_recovery_audit (
        topic_id, topic_name, visible_questions, orphans_recoverable, 
        legacy_recoverable, archived_recoverable, quarantined_recoverable, 
        unclassified_recoverable, total_recoverable, operational_deficit, 
        rps_score, classification, last_audit_at
    )
    VALUES (
        p_topic_id, v_topic_name, v_visible, v_orphans, 
        v_legacy, v_archived, v_quarantined, 
        v_unclassified, v_total_rec, v_deficit, 
        v_rps, v_classification, now()
    )
    ON CONFLICT (topic_id) DO UPDATE SET
        visible_questions = EXCLUDED.visible_questions,
        orphans_recoverable = EXCLUDED.orphans_recoverable,
        legacy_recoverable = EXCLUDED.legacy_recoverable,
        archived_recoverable = EXCLUDED.archived_recoverable,
        quarantined_recoverable = EXCLUDED.quarantined_recoverable,
        unclassified_recoverable = EXCLUDED.unclassified_recoverable,
        total_recoverable = EXCLUDED.total_recoverable,
        operational_deficit = EXCLUDED.operational_deficit,
        rps_score = EXCLUDED.rps_score,
        classification = EXCLUDED.classification,
        last_audit_at = now();
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger to refresh audit on question change (sample, can be more granular)
-- Add a unique constraint for ON CONFLICT
ALTER TABLE public.fccp_content_recovery_audit ADD CONSTRAINT unique_topic_id UNIQUE (topic_id);

-- 4. Create View for the report
CREATE OR REPLACE VIEW public.v_fccp_recovery_report AS
SELECT 
    topic_name as "Competência",
    visible_questions as "Visíveis",
    total_recoverable as "Recuperáveis",
    operational_deficit as "Déficit",
    rps_score as "RPS %",
    classification as "Status"
FROM public.fccp_content_recovery_audit
ORDER BY rps_score DESC;

GRANT SELECT ON public.v_fccp_recovery_report TO authenticated;
GRANT ALL ON public.v_fccp_recovery_report TO service_role;
