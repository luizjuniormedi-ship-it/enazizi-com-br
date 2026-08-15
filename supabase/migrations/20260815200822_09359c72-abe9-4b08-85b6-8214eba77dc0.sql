-- ENAZIZI Security Hardening (canonical project) — RLS + security_invoker views
-- Idempotent, no data changes.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_reports',
    'critical_competency_validation',
    'promotion_waves',
    'ugrp_eligibility_loss_log',
    'ugrp_question_funnel'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "admins_manage_%s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "admins_manage_%s" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t, t
    );
  END LOOP;
END $$;

DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'cvrp_ghost_competencies',
    'cvrp_specialty_stats',
    'ghost_competency_registry',
    'ugrp_moc_report',
    'ugrp_uis_dashboard',
    'v_ccpv_production_readiness',
    'v_cvrp_operational_certification',
    'v_cvrp_topic_link_health',
    'v_exact_topic_coverage_audit',
    'v_fccp_curriculum_completeness_score',
    'v_fccp_recovery_ranking',
    'v_fccp_recovery_report',
    'v_fccp_specialty_certification',
    'v_pmis_report',
    'v_production_readiness_score',
    'v_wave_2_stress_report',
    'view_curriculum_coverage_audit'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v AND c.relkind = 'v'
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
    END IF;
  END LOOP;
END $$;