
-- Seed initial control row
INSERT INTO public.enrichment_control (id, is_paused, processed_today)
VALUES (1, false, 0)
ON CONFLICT (id) DO NOTHING;

-- Reset daily counter helper
CREATE OR REPLACE FUNCTION public.reset_enrichment_daily_counter()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.enrichment_control
  SET processed_today = 0, updated_at = now()
  WHERE id = 1;
$$;

-- Pause/resume RPC (admin only)
CREATE OR REPLACE FUNCTION public.set_enrichment_paused(_paused boolean, _reason text DEFAULT NULL)
RETURNS public.enrichment_control
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.enrichment_control;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  UPDATE public.enrichment_control
  SET is_paused = _paused,
      pause_reason = CASE WHEN _paused THEN COALESCE(_reason, 'manual') ELSE NULL END,
      updated_at = now()
  WHERE id = 1
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- Sample of recently enriched questions (admin only)
CREATE OR REPLACE FUNCTION public.sample_enriched_questions(_n int DEFAULT 20)
RETURNS TABLE (
  id uuid,
  statement text,
  options jsonb,
  correct_index int,
  explanation text,
  quality_tier text,
  guideline_reference text,
  is_clinical_case boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  RETURN QUERY
  SELECT q.id, q.statement, q.options, q.correct_index, q.explanation,
         q.quality_tier, q.guideline_reference, q.is_clinical_case, q.updated_at
  FROM public.questions_bank q
  WHERE q.review_status = 'reviewed'
    AND q.updated_at > now() - interval '24 hours'
  ORDER BY random()
  LIMIT LEAST(GREATEST(_n, 1), 50);
END;
$$;

-- Aggregated dashboard (admin only)
CREATE OR REPLACE FUNCTION public.enrichment_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progress jsonb;
  v_control jsonb;
  v_cost_24h numeric;
  v_calls_24h int;
  v_rejection_24h numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;

  SELECT to_jsonb(v.*) INTO v_progress FROM public.v_enrichment_progress v;
  SELECT to_jsonb(c.*) INTO v_control FROM public.enrichment_control c WHERE id = 1;

  SELECT
    COALESCE(SUM((metadata->>'cost_usd')::numeric), 0),
    COUNT(*),
    AVG(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END)
  INTO v_cost_24h, v_calls_24h, v_rejection_24h
  FROM public.pipeline_governance
  WHERE pipeline_name = 'upgrade-questions'
    AND created_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'progress', v_progress,
    'control', v_control,
    'cost_24h_usd', ROUND(COALESCE(v_cost_24h, 0)::numeric, 4),
    'calls_24h', v_calls_24h,
    'rejection_rate_24h', ROUND(COALESCE(v_rejection_24h, 0)::numeric * 100, 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_enrichment_paused(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sample_enriched_questions(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enrichment_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_enrichment_daily_counter() TO authenticated;
