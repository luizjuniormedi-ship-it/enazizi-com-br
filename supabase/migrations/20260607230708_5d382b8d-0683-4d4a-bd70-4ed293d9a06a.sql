-- Initialize existing topics with the new COVE metrics
DO $$
DECLARE
    v_learning_yield NUMERIC;
    v_retention_gain NUMERIC;
    v_transfer_score NUMERIC;
    v_hospital_performance NUMERIC;
    v_approval_correlation NUMERIC;
    v_longitudinal_mastery NUMERIC;
    v_coi NUMERIC;
    v_cri NUMERIC;
    v_ips NUMERIC;
    r RECORD;
BEGIN
    FOR r IN SELECT id, cri_score FROM public.curriculum_topics LOOP
        -- Seed deterministic random values based on the ID for consistency during initialization
        v_learning_yield := floor((abs(hashtext(r.id::text)) % 40) + 30);
        v_retention_gain := floor((abs(hashtext(r.id::text || 'r')) % 30) + 40);
        v_transfer_score := floor((abs(hashtext(r.id::text || 't')) % 50) + 20);
        v_approval_correlation := floor((abs(hashtext(r.id::text || 'a')) % 60) + 20);
        v_longitudinal_mastery := floor((abs(hashtext(r.id::text || 'l')) % 40) + 10);
        v_cri := COALESCE(r.cri_score, 0);

        v_coi := (v_learning_yield * 0.25) + 
                 (v_retention_gain * 0.20) + 
                 (v_transfer_score * 0.35) + 
                 (v_approval_correlation * 0.10) + 
                 (v_longitudinal_mastery * 0.10);

        v_ips := v_cri * (v_coi / 100.0);

        UPDATE public.curriculum_topics
        SET 
            learning_yield = v_learning_yield,
            retention_gain = v_retention_gain,
            transfer_score = v_transfer_score,
            approval_correlation = v_approval_correlation,
            longitudinal_mastery = v_longitudinal_mastery,
            coi_score = ROUND(v_coi, 2),
            ips_score = ROUND(v_ips, 2)
        WHERE id = r.id;
    END LOOP;
END $$;
