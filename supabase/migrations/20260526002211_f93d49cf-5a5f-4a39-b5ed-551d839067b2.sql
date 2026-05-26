
-- 1. Orchestration traces table (explainability)
CREATE TABLE IF NOT EXISTS public.memory_orchestration_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  function_name text NOT NULL,
  question_preview text,
  exact_hit boolean NOT NULL DEFAULT false,
  semantic_hit boolean NOT NULL DEFAULT false,
  rag_hit boolean NOT NULL DEFAULT false,
  openai_called boolean NOT NULL DEFAULT false,
  memory_id uuid,
  orchestrator_action text,
  orchestrator_reason text,
  similarity numeric,
  latency_ms integer,
  embedding_ms integer,
  lookup_ms integer,
  rag_ms integer,
  llm_ms integer,
  model_used text,
  ab_compared boolean NOT NULL DEFAULT false,
  ab_delta_quality numeric
);

CREATE INDEX IF NOT EXISTS idx_mem_traces_created ON public.memory_orchestration_traces (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mem_traces_memory ON public.memory_orchestration_traces (memory_id);
CREATE INDEX IF NOT EXISTS idx_mem_traces_action ON public.memory_orchestration_traces (orchestrator_action);

ALTER TABLE public.memory_orchestration_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read orchestration traces" ON public.memory_orchestration_traces;
CREATE POLICY "admins read orchestration traces"
  ON public.memory_orchestration_traces
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Drift columns
ALTER TABLE public.tutor_knowledge_memory
  ADD COLUMN IF NOT EXISTS drift_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS reuse_entropy numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS last_drift_check_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tutor_memory_drift ON public.tutor_knowledge_memory (drift_score DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_risk ON public.tutor_knowledge_memory (risk_level);

-- 3. Drift analysis function
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
BEGIN
  -- Compute drift score and risk level for each memory
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

  -- Auto-quarantine: critical drift + hallucination OR very high failure rate
  UPDATE public.tutor_knowledge_memory
  SET promotion_status = 'quarantined'
  WHERE promotion_status NOT IN ('quarantined', 'canonical')
    AND (
      (drift_score >= 0.8 AND hallucination_flag)
      OR (reuse_failure_count >= 5 AND reuse_count > 0 AND (reuse_failure_count::numeric / reuse_count) >= 0.5)
    );
  GET DIAGNOSTICS v_quarantined = ROW_COUNT;

  SELECT count(*) INTO v_high_risk
  FROM public.tutor_knowledge_memory
  WHERE risk_level IN ('high', 'critical');

  RAISE LOG '[MEMORY_DRIFT_DETECTED] updated=% quarantined=% high_risk=%', v_updated, v_quarantined, v_high_risk;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'quarantined', v_quarantined,
    'high_risk', v_high_risk,
    'run_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.memory_drift_analysis() FROM PUBLIC, anon, authenticated;

-- 4. Dashboard aggregator
CREATE OR REPLACE FUNCTION public.memory_health_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'reuse', (
      SELECT jsonb_build_object(
        'total_memories', count(*),
        'total_reuses', COALESCE(sum(reuse_count), 0),
        'reuse_success', COALESCE(sum(reuse_success_count), 0),
        'reuse_failure', COALESCE(sum(reuse_failure_count), 0),
        'success_rate', CASE WHEN sum(reuse_success_count + reuse_failure_count) > 0
          THEN ROUND(sum(reuse_success_count)::numeric / sum(reuse_success_count + reuse_failure_count) * 100, 2)
          ELSE 0 END,
        'by_specialty', (
          SELECT jsonb_agg(jsonb_build_object('specialty', specialty, 'count', c, 'reuses', r))
          FROM (
            SELECT specialty, count(*) c, COALESCE(sum(reuse_count),0) r
            FROM tutor_knowledge_memory
            WHERE specialty IS NOT NULL
            GROUP BY specialty ORDER BY r DESC LIMIT 10
          ) s
        ),
        'by_stage', (
          SELECT jsonb_agg(jsonb_build_object('stage', cognitive_stage, 'count', count(*)))
          FROM tutor_knowledge_memory WHERE cognitive_stage IS NOT NULL
          GROUP BY cognitive_stage
        )
      )
      FROM tutor_knowledge_memory
    ),
    'quality', (
      SELECT jsonb_build_object(
        'avg_score', ROUND(COALESCE(avg(quality_score), 0)::numeric, 3),
        'with_bibliography', count(*) FILTER (WHERE has_bibliography),
        'with_language_purity', count(*) FILTER (WHERE language_purity),
        'pedagogical_depth_avg', ROUND(COALESCE(avg(pedagogical_depth), 0)::numeric, 2),
        'promotion_funnel', jsonb_build_object(
          'draft', count(*) FILTER (WHERE promotion_status = 'draft'),
          'validated', count(*) FILTER (WHERE promotion_status = 'validated'),
          'promoted', count(*) FILTER (WHERE promotion_status = 'promoted'),
          'canonical', count(*) FILTER (WHERE promotion_status = 'canonical'),
          'quarantined', count(*) FILTER (WHERE promotion_status = 'quarantined')
        )
      )
      FROM tutor_knowledge_memory
    ),
    'drift', (
      SELECT jsonb_build_object(
        'avg_drift', ROUND(COALESCE(avg(drift_score), 0)::numeric, 3),
        'avg_decay', ROUND(COALESCE(avg(decay_score), 0)::numeric, 3),
        'risk_levels', jsonb_build_object(
          'low', count(*) FILTER (WHERE risk_level = 'low'),
          'medium', count(*) FILTER (WHERE risk_level = 'medium'),
          'high', count(*) FILTER (WHERE risk_level = 'high'),
          'critical', count(*) FILTER (WHERE risk_level = 'critical')
        ),
        'stale_count', count(*) FILTER (WHERE last_validated_at < now() - interval '90 days'),
        'over_reused', count(*) FILTER (WHERE reuse_count > 50)
      )
      FROM tutor_knowledge_memory
    ),
    'cost', (
      SELECT jsonb_build_object(
        'last_30d_exact_hits', COALESCE(sum(exact_hits), 0),
        'last_30d_semantic_hits', COALESCE(sum(semantic_hits), 0),
        'last_30d_rag_hits', COALESCE(sum(rag_hits), 0),
        'last_30d_openai_calls', COALESCE(sum(openai_calls), 0),
        'last_30d_hit_rate', CASE WHEN sum(total_lookups) > 0
          THEN ROUND((sum(exact_hits + semantic_hits)::numeric / sum(total_lookups)) * 100, 2)
          ELSE 0 END,
        'last_30d_cost_saved_usd', ROUND(COALESCE(sum(cost_saved_usd), 0)::numeric, 2)
      )
      FROM memory_governance_metrics
      WHERE day >= current_date - interval '30 days'
    ),
    'safety', (
      SELECT jsonb_build_object(
        'hallucination_flagged', count(*) FILTER (WHERE hallucination_flag),
        'quarantined', count(*) FILTER (WHERE promotion_status = 'quarantined'),
        'poisoning_rate', CASE WHEN count(*) > 0
          THEN ROUND((count(*) FILTER (WHERE promotion_status = 'quarantined')::numeric / count(*)) * 100, 3)
          ELSE 0 END
      )
      FROM tutor_knowledge_memory
    ),
    'orchestration_24h', (
      SELECT jsonb_build_object(
        'total', count(*),
        'by_action', (
          SELECT jsonb_object_agg(orchestrator_action, c)
          FROM (
            SELECT orchestrator_action, count(*) c
            FROM memory_orchestration_traces
            WHERE created_at > now() - interval '24 hours'
              AND orchestrator_action IS NOT NULL
            GROUP BY orchestrator_action
          ) t
        ),
        'avg_latency_ms', ROUND(COALESCE(avg(latency_ms), 0)::numeric, 1),
        'avg_lookup_ms', ROUND(COALESCE(avg(lookup_ms), 0)::numeric, 1),
        'avg_llm_ms', ROUND(COALESCE(avg(llm_ms), 0)::numeric, 1),
        'ab_comparisons', count(*) FILTER (WHERE ab_compared)
      )
      FROM memory_orchestration_traces
      WHERE created_at > now() - interval '24 hours'
    ),
    'generated_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.memory_health_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.memory_health_dashboard() TO authenticated;

-- 5. Hallucination forensics
CREATE OR REPLACE FUNCTION public.memory_hallucination_forensics(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid,
  question_original text,
  specialty text,
  cognitive_stage text,
  promotion_status text,
  reuse_count int,
  reuse_failure_count int,
  drift_score numeric,
  risk_level text,
  last_validated_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT m.id, m.question_original, m.specialty, m.cognitive_stage, m.promotion_status,
         m.reuse_count, m.reuse_failure_count, m.drift_score, m.risk_level,
         m.last_validated_at, m.created_at
  FROM public.tutor_knowledge_memory m
  WHERE m.hallucination_flag = true OR m.promotion_status = 'quarantined' OR m.risk_level IN ('high','critical')
  ORDER BY m.drift_score DESC, m.reuse_failure_count DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.memory_hallucination_forensics(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.memory_hallucination_forensics(int) TO authenticated;
