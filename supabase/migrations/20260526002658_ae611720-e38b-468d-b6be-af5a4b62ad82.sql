
CREATE OR REPLACE FUNCTION public.memory_drift_analysis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
  v_quarantined int := 0;
  v_high_risk int := 0;
  v_total int := 0;
  v_would_quarantine int := 0;
  v_aborted boolean := false;
  v_cap_pct numeric := 0.10; -- 10% safety cap
BEGIN
  SELECT count(*) INTO v_total FROM public.tutor_knowledge_memory;

  -- 1. Recalculate drift_score / risk_level
  WITH calc AS (
    SELECT
      m.id,
      LEAST(1.0,
        GREATEST(0,
          (EXTRACT(epoch FROM (now() - COALESCE(m.last_validated_at, m.created_at))) / 86400.0 / 180.0) * 0.4
          + (m.reuse_failure_count::numeric / GREATEST(1, m.reuse_count)) * 0.3
          + (CASE WHEN m.hallucination_flag THEN 0.3 ELSE 0 END)
          + (CASE WHEN m.reuse_count > 50 AND COALESCE(m.last_validated_at, m.created_at) < now() - interval '60 days' THEN 0.2 ELSE 0 END)
        )
      ) AS new_drift
    FROM public.tutor_knowledge_memory m
  )
  UPDATE public.tutor_knowledge_memory m
  SET drift_score = c.new_drift,
      risk_level = CASE
        WHEN c.new_drift >= 0.7 THEN 'critical'
        WHEN c.new_drift >= 0.45 THEN 'high'
        WHEN c.new_drift >= 0.25 THEN 'medium'
        ELSE 'low'
      END,
      last_drift_check_at = now()
  FROM calc c
  WHERE m.id = c.id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- 2. Count candidates BEFORE quarantining
  SELECT count(*) INTO v_would_quarantine
  FROM public.tutor_knowledge_memory
  WHERE promotion_status NOT IN ('quarantined', 'canonical')
    AND (
      (drift_score >= 0.8 AND hallucination_flag)
      OR (reuse_failure_count >= 5 AND reuse_count > 0 AND (reuse_failure_count::numeric / reuse_count) >= 0.5)
    );

  -- 3. Safety cap: abort auto-quarantine if it would exceed 10% of base
  IF v_total > 0 AND v_would_quarantine::numeric / v_total > v_cap_pct THEN
    v_aborted := true;
    RAISE WARNING '[MEMORY_DRIFT_SAFETY_ABORT] would_quarantine=% total=% pct=% > cap=%',
      v_would_quarantine, v_total,
      ROUND(v_would_quarantine::numeric / v_total * 100, 2),
      ROUND(v_cap_pct * 100, 2);
  ELSE
    UPDATE public.tutor_knowledge_memory
    SET promotion_status = 'quarantined'
    WHERE promotion_status NOT IN ('quarantined', 'canonical')
      AND (
        (drift_score >= 0.8 AND hallucination_flag)
        OR (reuse_failure_count >= 5 AND reuse_count > 0 AND (reuse_failure_count::numeric / reuse_count) >= 0.5)
      );
    GET DIAGNOSTICS v_quarantined = ROW_COUNT;
  END IF;

  SELECT count(*) INTO v_high_risk
  FROM public.tutor_knowledge_memory
  WHERE risk_level IN ('high', 'critical');

  RAISE LOG '[MEMORY_DRIFT_DETECTED] total=% updated=% would_quarantine=% quarantined=% high_risk=% aborted=%',
    v_total, v_updated, v_would_quarantine, v_quarantined, v_high_risk, v_aborted;

  RETURN jsonb_build_object(
    'total_memories', v_total,
    'updated', v_updated,
    'would_quarantine', v_would_quarantine,
    'quarantined', v_quarantined,
    'aborted_quarantine', v_aborted,
    'safety_cap_pct', v_cap_pct * 100,
    'high_risk', v_high_risk,
    'run_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.memory_drift_analysis() FROM PUBLIC, anon, authenticated;
