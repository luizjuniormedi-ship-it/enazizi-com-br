-- ============================================================
-- SECURITY FIX: JWT Role Privilege Escalation v25
-- Replace all client-manipulable auth.jwt()->>'role' checks
-- with server-side has_role() verification.
-- ============================================================

-- --------------------------------------------------------
-- 1. cme_session_variants
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage variants" ON public.cme_session_variants;

CREATE POLICY "Admins can manage variants"
ON public.cme_session_variants
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- --------------------------------------------------------
-- 2. cme_video_projects
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own projects" ON public.cme_video_projects;
DROP POLICY IF EXISTS "Admins can view all CME data" ON public.cme_video_projects;

CREATE POLICY "Users can view own projects"
ON public.cme_video_projects
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all CME data"
ON public.cme_video_projects
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));


-- --------------------------------------------------------
-- 3. cme_render_segments
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view segments of their jobs" ON public.cme_render_segments;

CREATE POLICY "Users can view segments of their jobs"
ON public.cme_render_segments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cme_render_jobs
    WHERE cme_render_jobs.id = cme_render_segments.render_job_id
      AND cme_render_jobs.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);


-- --------------------------------------------------------
-- 4. cme_worker_nodes
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view workers" ON public.cme_worker_nodes;

CREATE POLICY "Admins can view workers"
ON public.cme_worker_nodes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));


-- --------------------------------------------------------
-- 5. drive_ingestion_log
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage drive ingestion logs" ON public.drive_ingestion_log;

CREATE POLICY "Admins can manage drive ingestion logs"
ON public.drive_ingestion_log
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


-- --------------------------------------------------------
-- 6. governance_logs
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view governance logs" ON public.governance_logs;

CREATE POLICY "Admins can view governance logs"
ON public.governance_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
