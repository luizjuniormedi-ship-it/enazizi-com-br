-- ════════════════════════════════════════════════════════════════════
-- Loop 4A — AI Cache Governance schema extensions (idempotent)
-- ════════════════════════════════════════════════════════════════════

-- 1) ai_content_cache: scope + user_id + semantic_hash
ALTER TABLE public.ai_content_cache
  ADD COLUMN IF NOT EXISTS user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS semantic_hash text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='ai_content_cache' AND constraint_name='ai_content_cache_scope_chk'
  ) THEN
    ALTER TABLE public.ai_content_cache
      ADD CONSTRAINT ai_content_cache_scope_chk CHECK (scope IN ('global','user'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='ai_content_cache' AND constraint_name='ai_content_cache_scope_user_chk'
  ) THEN
    -- user scope requires user_id; global scope must not have user_id (no leak)
    ALTER TABLE public.ai_content_cache
      ADD CONSTRAINT ai_content_cache_scope_user_chk CHECK (
        (scope = 'user'  AND user_id IS NOT NULL) OR
        (scope = 'global' AND user_id IS NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acc_scope_user_hash
  ON public.ai_content_cache (scope, user_id, semantic_hash)
  WHERE semantic_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acc_module_scope
  ON public.ai_content_cache (module, scope)
  WHERE module IS NOT NULL;

-- Admin read policy for auditoria (writes still blocked for non-service_role)
DROP POLICY IF EXISTS "admins_can_audit_ai_cache" ON public.ai_content_cache;
CREATE POLICY "admins_can_audit_ai_cache"
  ON public.ai_content_cache
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) ai_usage_logs: governance + cost columns (additive, no breakage)
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS module text NULL,
  ADD COLUMN IF NOT EXISTS cache_status text NULL,
  ADD COLUMN IF NOT EXISTS request_id text NULL,
  ADD COLUMN IF NOT EXISTS tokens_saved integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_saved numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS function_name text NULL,
  ADD COLUMN IF NOT EXISTS success boolean NULL,
  ADD COLUMN IF NOT EXISTS cache_hit boolean NULL,
  ADD COLUMN IF NOT EXISTS model_tier text NULL,
  ADD COLUMN IF NOT EXISTS cost_estimate numeric(12,6) NULL,
  ADD COLUMN IF NOT EXISTS error_message text NULL,
  ADD COLUMN IF NOT EXISTS actor_type text NULL,
  ADD COLUMN IF NOT EXISTS actor_key text NULL,
  ADD COLUMN IF NOT EXISTS response_time_ms integer NULL,
  ADD COLUMN IF NOT EXISTS tokens_used integer NULL,
  ADD COLUMN IF NOT EXISTS model_used text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema='public' AND constraint_name='ai_usage_logs_cache_status_chk'
  ) THEN
    ALTER TABLE public.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_cache_status_chk
      CHECK (cache_status IS NULL OR cache_status IN ('hit','miss','miss_expired','bypass','disabled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aiu_module_cache_status
  ON public.ai_usage_logs (module, cache_status, created_at DESC)
  WHERE module IS NOT NULL;

-- 3) Admin RPC: ai cache report
CREATE OR REPLACE FUNCTION public.admin_ai_cache_report(
  p_window_hours integer DEFAULT 24
)
RETURNS TABLE (
  module text,
  total_calls bigint,
  hits bigint,
  miss bigint,
  miss_expired bigint,
  hit_rate numeric,
  tokens_saved bigint,
  cost_saved numeric,
  global_leak_risk bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH logs AS (
    SELECT
      COALESCE(l.module, 'unknown') AS m,
      l.cache_status,
      COALESCE(l.tokens_saved, 0) AS ts,
      COALESCE(l.cost_saved, 0)   AS cs
    FROM public.ai_usage_logs l
    WHERE l.created_at >= now() - make_interval(hours => GREATEST(p_window_hours, 1))
      AND l.module IS NOT NULL
  ),
  agg AS (
    SELECT
      m,
      COUNT(*)::bigint AS total_calls,
      SUM(CASE WHEN cache_status = 'hit' THEN 1 ELSE 0 END)::bigint AS hits,
      SUM(CASE WHEN cache_status = 'miss' THEN 1 ELSE 0 END)::bigint AS miss,
      SUM(CASE WHEN cache_status = 'miss_expired' THEN 1 ELSE 0 END)::bigint AS miss_expired,
      SUM(ts)::bigint AS tokens_saved,
      SUM(cs)::numeric AS cost_saved
    FROM logs
    GROUP BY m
  ),
  risk AS (
    SELECT module AS m, COUNT(*)::bigint AS leaks
    FROM public.ai_content_cache
    WHERE scope = 'global' AND user_id IS NOT NULL
    GROUP BY module
  )
  SELECT
    a.m AS module,
    a.total_calls,
    a.hits,
    a.miss,
    a.miss_expired,
    CASE WHEN a.total_calls > 0
         THEN ROUND((a.hits::numeric / a.total_calls::numeric) * 100, 2)
         ELSE 0 END AS hit_rate,
    a.tokens_saved,
    a.cost_saved,
    COALESCE(r.leaks, 0) AS global_leak_risk
  FROM agg a
  LEFT JOIN risk r ON r.m = a.m
  ORDER BY a.total_calls DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_cache_report(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ai_cache_report(integer) TO authenticated;
