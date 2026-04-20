-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 3: Auto-fechamento do loop adaptativo
-- daily_plan_tasks.completed=true → trajectory_applied_actions.status='completed'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_close_trajectory_action_on_task_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action_id uuid;
  v_duration_min int;
BEGIN
  -- Só age na transição completed false → true
  IF NEW.completed IS DISTINCT FROM TRUE OR OLD.completed IS TRUE THEN
    RETURN NEW;
  END IF;

  v_duration_min := COALESCE(NEW.estimated_minutes, 0);

  -- Tentativa 1: vínculo direto via payload.plannerResponse.taskId
  SELECT id INTO v_action_id
  FROM public.trajectory_applied_actions
  WHERE user_id = NEW.user_id
    AND status = 'applied'
    AND (payload -> 'plannerResponse' ->> 'taskId') = NEW.id::text
  ORDER BY applied_at DESC
  LIMIT 1;

  -- Tentativa 2: fallback por janela do dia + topic match
  IF v_action_id IS NULL THEN
    SELECT taa.id INTO v_action_id
    FROM public.trajectory_applied_actions taa
    WHERE taa.user_id = NEW.user_id
      AND taa.status = 'applied'
      AND taa.applied_at >= (CURRENT_DATE - INTERVAL '1 day')
      AND (
        (taa.payload -> 'standardized' ->> 'topic') IS NOT DISTINCT FROM NEW.topic
        OR (taa.payload -> 'standardized' ->> 'topic') IS NULL
      )
    ORDER BY taa.applied_at DESC
    LIMIT 1;
  END IF;

  IF v_action_id IS NOT NULL THEN
    UPDATE public.trajectory_applied_actions
    SET status = 'completed',
        completed_at = COALESCE(NEW.completed_at, now()),
        outcome = COALESCE(outcome, '{}'::jsonb) || jsonb_build_object(
          'task_id', NEW.id,
          'completed_at', COALESCE(NEW.completed_at, now()),
          'duration_minutes', v_duration_min,
          'source', 'auto_trigger'
        ),
        updated_at = now()
    WHERE id = v_action_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_trajectory_on_task_complete ON public.daily_plan_tasks;
CREATE TRIGGER trg_close_trajectory_on_task_complete
AFTER UPDATE OF completed ON public.daily_plan_tasks
FOR EACH ROW
EXECUTE FUNCTION public.tg_close_trajectory_action_on_task_complete();