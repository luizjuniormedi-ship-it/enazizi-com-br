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
    -- Corrected: Use 'nome' instead of 'name'
    SELECT nome INTO v_topic_name FROM public.curriculum_topics WHERE id = p_topic_id;
    
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
        topic_name = EXCLUDED.topic_name,
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
