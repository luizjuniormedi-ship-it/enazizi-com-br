
-- ============================================================
-- ETAPA 2 — RLS hardening: substituir USING(true) por has_role
-- ============================================================

-- Helper macro: drop+recreate per table for admin-only ALL
-- 1) ai_video_lessons
DROP POLICY IF EXISTS "Admins possuem acesso total às videoaulas" ON public.ai_video_lessons;
CREATE POLICY "Admins manage ai_video_lessons"
  ON public.ai_video_lessons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) CME admin-only infra tables (ALL with qual=true)
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cme_adaptive_pacing_maps',
    'cme_adaptive_timing_maps',
    'cme_autoscaling_events',
    'cme_cinematic_reference_profiles',
    'cme_cluster_metrics',
    'cme_cognitive_pacing',
    'cme_explainable_scores',
    'cme_governance_logs',
    'cme_governance_reviews',
    'cme_narrative_scripts',
    'cme_playback_hotspots',
    'cme_reference_uploads',
    'cme_semantic_plans',
    'cme_video_assets',
    'cme_voice_assets',
    'cme_timeline_clips',
    'cme_timeline_tracks'
  ]) LOOP
    -- drop ALL existing permissive policies on each
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage pacing maps" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage CME timing maps" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage autoscaling events" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage reference profiles" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage cluster metrics" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage CME pacing" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage CME explainable scores" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage governance" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage CME governance" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage CME scripts" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage CME hotspots" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage reference uploads" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage CME semantic plans" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage CME assets" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage voice assets" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own clips" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own timelines" ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY "admins_manage_%s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
      t, t
    );
  END LOOP;
END$$;

-- 3) Workers/render tables: service_role only (revoke public)
DROP POLICY IF EXISTS "Workers can read and update their own status" ON public.cme_gpu_workers;
DROP POLICY IF EXISTS "Workers manage chunks" ON public.cme_render_chunks;
DROP POLICY IF EXISTS "Workers can report failures" ON public.cme_render_failures;

CREATE POLICY "service_role_manages_gpu_workers"
  ON public.cme_gpu_workers FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins_view_gpu_workers"
  ON public.cme_gpu_workers FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service_role_manages_render_chunks"
  ON public.cme_render_chunks FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins_view_render_chunks"
  ON public.cme_render_chunks FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "service_role_inserts_render_failures"
  ON public.cme_render_failures FOR INSERT
  TO service_role WITH CHECK (true);
CREATE POLICY "admins_view_render_failures"
  ON public.cme_render_failures FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) exam_blueprints: admin/professor only
DROP POLICY IF EXISTS "Service role gerencia versões" ON public.exam_blueprint_versions;
DROP POLICY IF EXISTS "Service role pode gerenciar blueprints" ON public.exam_blueprints;

CREATE POLICY "staff_manage_exam_blueprints"
  ON public.exam_blueprints FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'));
CREATE POLICY "service_role_manages_exam_blueprints"
  ON public.exam_blueprints FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "staff_manage_exam_blueprint_versions"
  ON public.exam_blueprint_versions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'));
CREATE POLICY "service_role_manages_exam_blueprint_versions"
  ON public.exam_blueprint_versions FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- 5) Public log spam mitigations (require authenticated)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.ai_content_audit_logs;
CREATE POLICY "auth_insert_audit_logs"
  ON public.ai_content_audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "System can insert governance logs" ON public.governance_logs;
CREATE POLICY "auth_insert_governance_logs"
  ON public.governance_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- ETAPA 3 — Storage hardening
-- ============================================================

-- tutor-lesson-videos: remove leitura/escrita pública genérica
DROP POLICY IF EXISTS "Public Access for tutor videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload tutor videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete tutor videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update/delete tutor videos" ON storage.objects;
-- staff policies (tutor_lesson_videos_staff_*) já existem e cobrem o caso correto.

-- cme-references: exigir admin/professor
DROP POLICY IF EXISTS "Admins can read references" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload references" ON storage.objects;
CREATE POLICY "staff_read_cme_references"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cme-references'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'))
  );
CREATE POLICY "staff_upload_cme_references"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cme-references'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'))
  );

-- video-lessons: upload exige admin/professor (leitura segue pública para alunos)
DROP POLICY IF EXISTS "Auth upload video-lessons" ON storage.objects;
CREATE POLICY "staff_upload_video_lessons"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'video-lessons'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professor'))
  );
