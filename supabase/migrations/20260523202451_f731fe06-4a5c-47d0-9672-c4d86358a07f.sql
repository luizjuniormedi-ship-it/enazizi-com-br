
-- 1. Fix is_admin() to use user_roles (no metadata escalation)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  );
$$;

-- 2. ai_prompt_registry — restrict SELECT to admin/professor
DROP POLICY IF EXISTS "Admins can view prompts" ON public.ai_prompt_registry;
CREATE POLICY "Staff can view prompts" ON public.ai_prompt_registry
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role));

-- 3. CME operational tables — admin only
DROP POLICY IF EXISTS "Admins manage hls manifests" ON public.cme_hls_manifests;
CREATE POLICY "Admins manage hls manifests" ON public.cme_hls_manifests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage incidents" ON public.cme_incidents;
CREATE POLICY "Admins manage incidents" ON public.cme_incidents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage reprocessing jobs" ON public.cme_media_reprocessing_jobs;
DROP POLICY IF EXISTS "Admins can view reprocessing jobs" ON public.cme_media_reprocessing_jobs;
CREATE POLICY "Admins manage reprocessing jobs" ON public.cme_media_reprocessing_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view validation logs" ON public.cme_media_validation_logs;
CREATE POLICY "Admins view validation logs" ON public.cme_media_validation_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view quality analysis" ON public.cme_quality_analysis;
CREATE POLICY "Admins view quality analysis" ON public.cme_quality_analysis
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view regression tests" ON public.cme_regression_tests;
CREATE POLICY "Admins view regression tests" ON public.cme_regression_tests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage render outputs" ON public.cme_render_outputs;
CREATE POLICY "Admins manage render outputs" ON public.cme_render_outputs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage variants" ON public.cme_variant_generation_logs;
CREATE POLICY "Admins manage variants" ON public.cme_variant_generation_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage grammar" ON public.cme_visual_grammar_profiles;
CREATE POLICY "Admins manage grammar" ON public.cme_visual_grammar_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage voice profiles" ON public.cme_voice_profiles;
CREATE POLICY "Admins manage voice profiles" ON public.cme_voice_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. cme_pipeline_events — owner + admin
DROP POLICY IF EXISTS "Public read for pipeline events" ON public.cme_pipeline_events;
DROP POLICY IF EXISTS "Allow authenticated insert for pipeline events" ON public.cme_pipeline_events;
DROP POLICY IF EXISTS "Allow authenticated update for pipeline events" ON public.cme_pipeline_events;
CREATE POLICY "Admins view all pipeline events" ON public.cme_pipeline_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. drive_folders_scan — service_role/admin only
DROP POLICY IF EXISTS "Service role can do everything" ON public.drive_folders_scan;
CREATE POLICY "Admins manage drive folder scans" ON public.drive_folders_scan
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. pedagogical_events — remove public ALL
DROP POLICY IF EXISTS "Service role has full access" ON public.pedagogical_events;
CREATE POLICY "Admins view all pedagogical events" ON public.pedagogical_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. rag_knowledge_base — staff-only writes
DROP POLICY IF EXISTS "All can insert" ON public.rag_knowledge_base;
DROP POLICY IF EXISTS "All can update" ON public.rag_knowledge_base;
CREATE POLICY "Staff can insert rag" ON public.rag_knowledge_base
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role));
CREATE POLICY "Staff can update rag" ON public.rag_knowledge_base
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role));

-- 8. shadow_adaptive_metrics — owner + admin
DROP POLICY IF EXISTS "Admin full access shadow_metrics" ON public.shadow_adaptive_metrics;
CREATE POLICY "Users view own shadow metrics" ON public.shadow_adaptive_metrics
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own shadow metrics" ON public.shadow_adaptive_metrics
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage shadow metrics" ON public.shadow_adaptive_metrics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 9. video_lesson_usage_logs — owner + admin only
DROP POLICY IF EXISTS "Admins podem ver todos os logs de videoaula" ON public.video_lesson_usage_logs;
CREATE POLICY "Admins view all video logs" ON public.video_lesson_usage_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
