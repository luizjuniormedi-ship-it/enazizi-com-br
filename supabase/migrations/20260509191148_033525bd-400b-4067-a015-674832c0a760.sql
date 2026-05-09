-- ============================================================
-- Loop 2 Planner: normalization + idempotency (v2 — trigger-based hash)
-- ============================================================

-- 1) daily_plans: canonical plan_json + request_hash
ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS daily_plans_user_date_request_hash_uniq
  ON public.daily_plans (user_id, plan_date, request_hash)
  WHERE request_hash IS NOT NULL;

UPDATE public.daily_plans
SET plan_json = jsonb_build_object(
  'tasks', plan_json,
  'metadata', jsonb_build_object(
    'version', 'v2',
    'generated_at', COALESCE(updated_at, created_at, now())::text,
    'source', 'legacy_array_migration'
  )
)
WHERE jsonb_typeof(plan_json) = 'array';

UPDATE public.daily_plans
SET plan_json = jsonb_build_object(
  'tasks', plan_json -> 'blocks',
  'metadata', (plan_json - 'blocks')
    || jsonb_build_object(
         'version', 'v2',
         'generated_at', COALESCE(updated_at, created_at, now())::text,
         'source', 'legacy_blocks_migration'
       )
)
WHERE jsonb_typeof(plan_json) = 'object'
  AND plan_json ? 'blocks'
  AND NOT (plan_json ? 'tasks');

UPDATE public.daily_plans
SET plan_json = jsonb_build_object(
  'tasks', '[]'::jsonb,
  'metadata', plan_json
    || jsonb_build_object(
         'version', 'v2',
         'generated_at', COALESCE(updated_at, created_at, now())::text,
         'source', 'legacy_unknown_migration'
       )
)
WHERE jsonb_typeof(plan_json) = 'object'
  AND NOT (plan_json ? 'tasks')
  AND NOT (plan_json ? 'blocks');

-- 2) professor_plan_daily_tasks: task_hash via trigger
ALTER TABLE public.professor_plan_daily_tasks
  ADD COLUMN IF NOT EXISTS task_hash text;

CREATE OR REPLACE FUNCTION public.set_professor_plan_task_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.task_hash := md5(
    coalesce(NEW.plan_id::text, '')
    || '|' || coalesce(NEW.user_id::text, '')
    || '|' || coalesce(NEW.planned_date::text, '')
    || '|' || coalesce((NEW.task_payload->>'subtopic_id'), '')
    || '|' || coalesce(NEW.task_type, '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_professor_plan_task_hash ON public.professor_plan_daily_tasks;
CREATE TRIGGER trg_professor_plan_task_hash
  BEFORE INSERT OR UPDATE OF plan_id, user_id, planned_date, task_payload, task_type
  ON public.professor_plan_daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_professor_plan_task_hash();

-- Backfill any existing rows
UPDATE public.professor_plan_daily_tasks
SET task_hash = md5(
  coalesce(plan_id::text, '')
  || '|' || coalesce(user_id::text, '')
  || '|' || coalesce(planned_date::text, '')
  || '|' || coalesce((task_payload->>'subtopic_id'), '')
  || '|' || coalesce(task_type, '')
)
WHERE task_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS professor_plan_daily_tasks_task_hash_uniq
  ON public.professor_plan_daily_tasks (task_hash);
