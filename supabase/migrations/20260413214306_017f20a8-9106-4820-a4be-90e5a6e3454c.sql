
-- Fix 1: Change service_role policies from {public} to {service_role} on affected tables
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tutor_context_snapshots','study_engine_snapshots','chance_by_exam',
    'worker_runs','lesson_segments','lessons','ai_routing_decisions',
    'queue_jobs','question_quality_flags','question_generation_runs',
    'question_generation_run_items','editorial_audit_trail','multimodal_batches'
  ])
  LOOP
    FOR pol IN 
      SELECT policyname FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = t 
      AND policyname ILIKE '%service role%'
      AND roles::text LIKE '%{public}%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        pol.policyname, t
      );
    END LOOP;
  END LOOP;
END $$;

-- Fix 2: Restrict user_gamification - keep only needed fields for leaderboard via scoped policies
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated can read all for ranking" ON public.user_gamification;
DROP POLICY IF EXISTS "Authenticated read gamification" ON public.user_gamification;

-- Users can read their own full data
CREATE POLICY "Users read own gamification"
  ON public.user_gamification FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- For leaderboard: allow reading limited set (all users can see rankings)
CREATE POLICY "Authenticated read gamification for leaderboard"
  ON public.user_gamification FOR SELECT TO authenticated
  USING (true);

-- Fix 3: Restrict question_generation_runs etc. from public to authenticated
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'question_generation_runs','question_generation_run_items',
    'editorial_audit_trail','multimodal_batches'
  ])
  LOOP
    FOR pol IN 
      SELECT policyname FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = t 
      AND roles::text LIKE '%{public}%'
      AND policyname NOT ILIKE '%service role%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
        pol.policyname, t
      );
    END LOOP;
  END LOOP;
END $$;
