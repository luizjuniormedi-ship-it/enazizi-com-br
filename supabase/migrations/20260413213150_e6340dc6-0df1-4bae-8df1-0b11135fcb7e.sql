
-- Drop existing service_role policies if they exist, then recreate
DROP POLICY IF EXISTS "Service role manages qa_runs" ON public.qa_runs;
CREATE POLICY "Service role manages qa_runs" ON public.qa_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages worker_runs" ON public.worker_runs;
CREATE POLICY "Service role manages worker_runs" ON public.worker_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages lesson_segments" ON public.lesson_segments;
CREATE POLICY "Service role manages lesson_segments" ON public.lesson_segments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages queue_jobs" ON public.queue_jobs;
CREATE POLICY "Service role manages queue_jobs" ON public.queue_jobs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages ai_routing_decisions" ON public.ai_routing_decisions;
CREATE POLICY "Service role manages ai_routing_decisions" ON public.ai_routing_decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages question_generation_runs" ON public.question_generation_runs;
CREATE POLICY "Service role manages question_generation_runs" ON public.question_generation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages question_generation_run_items" ON public.question_generation_run_items;
CREATE POLICY "Service role manages question_generation_run_items" ON public.question_generation_run_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- editorial_audit_trail: restrict to authenticated
DROP POLICY IF EXISTS "Authenticated read audit trail" ON public.editorial_audit_trail;
CREATE POLICY "Authenticated read audit trail" ON public.editorial_audit_trail
  FOR SELECT TO authenticated USING (true);

-- multimodal_batches: restrict to authenticated
DROP POLICY IF EXISTS "Authenticated read multimodal_batches" ON public.multimodal_batches;
CREATE POLICY "Authenticated read multimodal_batches" ON public.multimodal_batches
  FOR SELECT TO authenticated USING (true);

-- pipeline_alerts: restrict insert to service_role
DROP POLICY IF EXISTS "Service role inserts pipeline alerts" ON public.pipeline_alerts;
CREATE POLICY "Service role inserts pipeline alerts" ON public.pipeline_alerts
  FOR INSERT TO service_role WITH CHECK (true);
