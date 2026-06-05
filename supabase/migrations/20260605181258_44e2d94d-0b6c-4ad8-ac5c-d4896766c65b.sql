-- Step 0: Cleanup
DELETE FROM enamed_curriculum_matrix a
USING enamed_curriculum_matrix b
WHERE a.id > b.id AND a.theme = b.theme;

-- Step 1: Evidence Snapshots (Longitudinal)
CREATE TABLE IF NOT EXISTS public.enamed_evidence_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day_offset INTEGER NOT NULL, -- 0, 30, 60, 90
    readiness_score NUMERIC,
    approval_probability NUMERIC,
    accuracy_rate NUMERIC,
    topics_covered INTEGER,
    retention_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, day_offset)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_evidence_snapshots TO authenticated;
GRANT ALL ON public.enamed_evidence_snapshots TO service_role;
ALTER TABLE public.enamed_evidence_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own evidence" ON public.enamed_evidence_snapshots FOR ALL USING (auth.uid() = user_id);

-- Step 2: Function to Capture Evidence Snapshot
CREATE OR REPLACE FUNCTION public.capture_enamed_evidence_snapshot(
    p_user_id UUID,
    p_day_offset INTEGER
) RETURNS VOID AS $$
DECLARE
    v_readiness NUMERIC;
    v_prob NUMERIC;
    v_acc NUMERIC;
    v_covered INTEGER;
    v_retention NUMERIC;
BEGIN
    -- Current Readiness
    SELECT current_probability, readiness_score INTO v_prob, v_readiness
    FROM enamed_approval_forecasts
    WHERE user_id = p_user_id;

    -- Accuracy (last 100)
    SELECT AVG(CASE WHEN is_correct THEN 100 ELSE 0 END) INTO v_acc
    FROM study_performance
    WHERE user_id = p_user_id;

    -- Topics Covered
    SELECT COUNT(*) INTO v_covered
    FROM student_mastery_metrics
    WHERE user_id = p_user_id AND theoretical_score > 0.7;

    -- Retention (mock/fsrs)
    v_retention := 85; -- Default baseline

    INSERT INTO enamed_evidence_snapshots 
        (user_id, day_offset, readiness_score, approval_probability, accuracy_rate, topics_covered, retention_score)
    VALUES 
        (p_user_id, p_day_offset, v_readiness, v_prob, v_acc, v_covered, v_retention)
    ON CONFLICT (user_id, day_offset) DO UPDATE SET
        readiness_score = EXCLUDED.readiness_score,
        approval_probability = EXCLUDED.approval_probability,
        accuracy_rate = EXCLUDED.accuracy_rate,
        topics_covered = EXCLUDED.topics_covered,
        retention_score = EXCLUDED.retention_score,
        created_at = now();
END;
$$ LANGUAGE plpgsql;
