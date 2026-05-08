-- ============================================================================
-- SPRINT 1: SECURITY HARDENING - RLS + SECURITY DEFINER search_path
-- ============================================================================
-- Strategy:
--   * "Service role only" means: RLS enabled + explicit deny policy for
--     authenticated/anon. service_role bypasses RLS automatically.
--   * "Owner" means: USING auth.uid() = user_id, writes via backend.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PART 1: ENABLE RLS on 11 cme_* operational tables (currently no RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.cme_budget_alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_buffer_metrics           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_gpu_cost_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_lineage_transformations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_recovery_actions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_resume_points            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_retry_attempts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_retry_policies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_stage_failures           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_v3_feature_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_worker_draining_events   ENABLE ROW LEVEL SECURITY;

-- Explicit "service role only" policies for the 11 newly-RLS cme_* tables
DO $$
DECLARE
  t text;
  cme_tables text[] := ARRAY[
    'cme_budget_alerts','cme_buffer_metrics','cme_gpu_cost_metrics',
    'cme_lineage_transformations','cme_recovery_actions','cme_resume_points',
    'cme_retry_attempts','cme_retry_policies','cme_stage_failures',
    'cme_v3_feature_flags','cme_worker_draining_events'
  ];
BEGIN
  FOREACH t IN ARRAY cme_tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "service_role_only_deny_clients" ON public.%I',
      t
    );
    EXECUTE format(
      'CREATE POLICY "service_role_only_deny_clients" ON public.%I
         FOR ALL
         TO authenticated, anon
         USING (false)
         WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- PART 2: 18 tables with RLS-ON but NO POLICY — declare explicit intent
-- ---------------------------------------------------------------------------

-- 2a) SENSITIVE LOGS / PIPELINE INTERNALS — service role only
DO $$
DECLARE
  t text;
  service_only_tables text[] := ARRAY[
    'security_audit_logs',
    'pipeline_lock','pipeline_logs','pipeline_progress',
    'exam_raw_data',
    'cme_learning_feedback','cme_lineage_edges','cme_lineage_nodes',
    'cme_queue_priorities','cme_render_costs','cme_stage_executions',
    'cme_worker_failures','cme_worker_heartbeats',
    'ai_cache'
  ];
BEGIN
  FOREACH t IN ARRAY service_only_tables LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "service_role_only_deny_clients" ON public.%I',
      t
    );
    EXECUTE format(
      'CREATE POLICY "service_role_only_deny_clients" ON public.%I
         FOR ALL
         TO authenticated, anon
         USING (false)
         WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- 2b) PEDAGOGICAL_INSIGHTS — owner read, service role writes
DROP POLICY IF EXISTS "Users can read their own pedagogical insights" ON public.pedagogical_insights;
CREATE POLICY "Users can read their own pedagogical insights"
  ON public.pedagogical_insights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role_writes_only" ON public.pedagogical_insights;
CREATE POLICY "service_role_writes_only"
  ON public.pedagogical_insights
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 2c) COGNITIVE_DRIFT_LOGS — owner read, service role writes
DROP POLICY IF EXISTS "Users can read their own cognitive drift" ON public.cognitive_drift_logs;
CREATE POLICY "Users can read their own cognitive drift"
  ON public.cognitive_drift_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role_writes_only" ON public.cognitive_drift_logs;
CREATE POLICY "service_role_writes_only"
  ON public.cognitive_drift_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "no_updates_or_deletes" ON public.cognitive_drift_logs;
CREATE POLICY "no_updates_or_deletes"
  ON public.cognitive_drift_logs
  FOR UPDATE
  TO authenticated, anon
  USING (false);

-- 2d) INCIDENT_ACKNOWLEDGEMENTS — owner can read & insert their own ack
DROP POLICY IF EXISTS "Users can read their own incident acks" ON public.incident_acknowledgements;
CREATE POLICY "Users can read their own incident acks"
  ON public.incident_acknowledgements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own incident acks" ON public.incident_acknowledgements;
CREATE POLICY "Users can insert their own incident acks"
  ON public.incident_acknowledgements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2e) TEACHER_SIMULADO_STATUS_HISTORY — only the professor who changed
--     the status, or admins, may read. Writes via service role / triggers.
DROP POLICY IF EXISTS "Author or admin can read status history" ON public.teacher_simulado_status_history;
CREATE POLICY "Author or admin can read status history"
  ON public.teacher_simulado_status_history
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = changed_by
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_role_writes_only" ON public.teacher_simulado_status_history;
CREATE POLICY "service_role_writes_only"
  ON public.teacher_simulado_status_history
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- PART 3: ai_content_cache — remove the broad "Authenticated users can read"
--         policy that leaks AI outputs across users. Replace with backend-only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.ai_content_cache;
DROP POLICY IF EXISTS "service_role_only_deny_clients"     ON public.ai_content_cache;
CREATE POLICY "service_role_only_deny_clients"
  ON public.ai_content_cache
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- PART 4: SECURITY DEFINER functions — fix mutable search_path (28 funcs)
--         Behaviour preserved; only adds `SET search_path = public`.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.admin_telemetry_audit()                                                     SET search_path = public;
ALTER FUNCTION public.admin_telemetry_optimization_report(integer)                                SET search_path = public;
ALTER FUNCTION public.admin_telemetry_rca(text)                                                   SET search_path = public;
ALTER FUNCTION public.admin_telemetry_v2_ai_quality(integer)                                      SET search_path = public;
ALTER FUNCTION public.admin_telemetry_v2_pedagogy(integer)                                        SET search_path = public;
ALTER FUNCTION public.append_questions_to_job(uuid, jsonb, simulation_job_status)                 SET search_path = public;
ALTER FUNCTION public.calculate_cme_job_costs()                                                   SET search_path = public;
ALTER FUNCTION public.check_feature_access(text, uuid)                                            SET search_path = public;
ALTER FUNCTION public.cleanup_tutor_cache()                                                       SET search_path = public;
ALTER FUNCTION public.cme_audit_rls_violation()                                                   SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint)                                                  SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb)                                                  SET search_path = public;
ALTER FUNCTION public.evaluate_adaptive_intervention(uuid, text, uuid, uuid, double precision, jsonb) SET search_path = public;
ALTER FUNCTION public.execute_data_retention()                                                    SET search_path = public;
ALTER FUNCTION public.generate_incident_rca(uuid)                                                 SET search_path = public;
ALTER FUNCTION public.handle_simulado_status_change()                                             SET search_path = public;
ALTER FUNCTION public.log_ai_alert(text, text, text, uuid, jsonb)                                 SET search_path = public;
ALTER FUNCTION public.log_exam_blueprint_drift()                                                  SET search_path = public;
ALTER FUNCTION public.log_multimodal_audit(text, text, jsonb, jsonb, integer, text, text)         SET search_path = public;
ALTER FUNCTION public.mark_stale_cme_jobs_failed()                                                SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)                                      SET search_path = public;
ALTER FUNCTION public.on_telemetry_event_incident_trigger()                                       SET search_path = public;
ALTER FUNCTION public.process_adaptive_friction_event()                                           SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer)                                    SET search_path = public;
ALTER FUNCTION public.reconcile_and_smooth_weights(text, numeric)                                 SET search_path = public;
ALTER FUNCTION public.record_clinical_audit(text, text, text, text, numeric, numeric, numeric, numeric) SET search_path = public;
ALTER FUNCTION public.refresh_video_cognitive_heatmap(uuid)                                       SET search_path = public;
ALTER FUNCTION public.update_content_status_on_review()                                           SET search_path = public;