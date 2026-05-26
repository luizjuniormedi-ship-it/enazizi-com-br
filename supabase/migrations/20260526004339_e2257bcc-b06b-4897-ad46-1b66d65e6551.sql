
-- =========================================================
-- 1. cme_render_logs: restrict write/all to service_role
-- =========================================================
DROP POLICY IF EXISTS "System can manage cme logs" ON public.cme_render_logs;
CREATE POLICY "Service role manages cme render logs"
ON public.cme_render_logs
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view cme render logs"
ON public.cme_render_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 2. cme_render_workers: restrict to service_role
-- =========================================================
DROP POLICY IF EXISTS "System can manage workers" ON public.cme_render_workers;
CREATE POLICY "Service role manages cme render workers"
ON public.cme_render_workers
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view cme render workers"
ON public.cme_render_workers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 3. item_exposure_control & item_calibration_jobs
-- =========================================================
DROP POLICY IF EXISTS "System can manage items" ON public.item_exposure_control;
CREATE POLICY "Service role manages item exposure"
ON public.item_exposure_control
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view item exposure"
ON public.item_exposure_control
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "System can manage calibration" ON public.item_calibration_jobs;
CREATE POLICY "Service role manages calibration"
ON public.item_calibration_jobs
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can view calibration jobs"
ON public.item_calibration_jobs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 4. Storage: official-* buckets — restrict uploads to admins/service_role
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can upload to harvester buckets" ON storage.objects;

CREATE POLICY "Admins or service role can upload to official buckets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id LIKE 'official-%'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- =========================================================
-- 5. profiles: prevent self-promotion via role/user_type self-update
-- =========================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_role_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role or user_type is being changed
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.user_type IS DISTINCT FROM OLD.user_type) THEN
    -- Only admins can change role/user_type
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Você não tem permissão para alterar role ou user_type do perfil.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_self_update();

-- =========================================================
-- 6. ai_incidents: admin-only authenticated
-- =========================================================
DROP POLICY IF EXISTS "Admins can view incidents" ON public.ai_incidents;
CREATE POLICY "Admins can view ai incidents"
ON public.ai_incidents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 7. ai_gateway_cache: require authentication for read
-- =========================================================
DROP POLICY IF EXISTS "Anyone can read cache" ON public.ai_gateway_cache;
CREATE POLICY "Authenticated users can read ai cache"
ON public.ai_gateway_cache
FOR SELECT
TO authenticated
USING (true);

-- =========================================================
-- 8. ingestion_pipeline_runs: admin-only authenticated
-- =========================================================
DROP POLICY IF EXISTS "Admins can view ingestion runs" ON public.ingestion_pipeline_runs;
CREATE POLICY "Admins can view ingestion runs"
ON public.ingestion_pipeline_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 9. rag_knowledge_base: require auth for read
-- =========================================================
DROP POLICY IF EXISTS "All can read" ON public.rag_knowledge_base;
CREATE POLICY "Authenticated users can read rag knowledge base"
ON public.rag_knowledge_base
FOR SELECT
TO authenticated
USING (true);

-- =========================================================
-- 10. ai_cost_metrics: scope to own user or admin
-- =========================================================
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.ai_cost_metrics;
CREATE POLICY "Users see own ai cost or admins see all"
ON public.ai_cost_metrics
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
