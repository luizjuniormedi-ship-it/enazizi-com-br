
-- 1) Status com 'structuring'
ALTER TABLE public.tutor_lesson_memory
  DROP CONSTRAINT IF EXISTS tutor_lesson_memory_status_check;
ALTER TABLE public.tutor_lesson_memory
  ADD CONSTRAINT tutor_lesson_memory_status_check
  CHECK (status IN (
    'structuring','pending_review','in_production','needs_adjustment',
    'ready_to_publish','published','unpublished',
    'archived','rejected','deleted'
  ));

-- 2) Novos campos
ALTER TABLE public.tutor_lesson_memory
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS pedagogical_quality_score integer,
  ADD COLUMN IF NOT EXISTS quality_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS structuring_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_structuring_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_structuring_error text;

-- 3) Atualizar trigger de proteção (incluir novos campos administrativos)
CREATE OR REPLACE FUNCTION public.protect_tutor_lesson_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sistema (service role / sem auth) e staff: liberados
  IF auth.uid() IS NULL OR public.is_lesson_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() <> NEW.user_id THEN
    RAISE EXCEPTION 'Aluno não pode alterar aulas de outros usuários';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Aluno não pode alterar status'; END IF;
  IF NEW.video_url IS DISTINCT FROM OLD.video_url THEN RAISE EXCEPTION 'Aluno não pode alterar video_url'; END IF;
  IF NEW.thumbnail_url IS DISTINCT FROM OLD.thumbnail_url THEN RAISE EXCEPTION 'Aluno não pode alterar thumbnail'; END IF;
  IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN RAISE EXCEPTION 'Aluno não pode alterar published_at'; END IF;
  IF NEW.teacher_id IS DISTINCT FROM OLD.teacher_id THEN RAISE EXCEPTION 'Aluno não pode alterar teacher_id'; END IF;
  IF NEW.hidden_from_student IS DISTINCT FROM OLD.hidden_from_student THEN RAISE EXCEPTION 'Aluno não pode alterar hidden_from_student'; END IF;
  IF NEW.hard_deleted IS DISTINCT FROM OLD.hard_deleted THEN RAISE EXCEPTION 'Aluno não pode alterar hard_deleted'; END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN RAISE EXCEPTION 'Aluno não pode alterar deleted_at'; END IF;
  IF NEW.deleted_by IS DISTINCT FROM OLD.deleted_by THEN RAISE EXCEPTION 'Aluno não pode alterar deleted_by'; END IF;
  IF NEW.is_recommended IS DISTINCT FROM OLD.is_recommended THEN RAISE EXCEPTION 'Aluno não pode alterar is_recommended'; END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN RAISE EXCEPTION 'Aluno não pode alterar priority'; END IF;
  IF NEW.duration IS DISTINCT FROM OLD.duration THEN RAISE EXCEPTION 'Aluno não pode alterar duration'; END IF;
  IF NEW.structured_content IS DISTINCT FROM OLD.structured_content THEN RAISE EXCEPTION 'Aluno não pode alterar structured_content'; END IF;
  IF NEW.summary IS DISTINCT FROM OLD.summary THEN RAISE EXCEPTION 'Aluno não pode alterar summary'; END IF;
  IF NEW.pedagogical_quality_score IS DISTINCT FROM OLD.pedagogical_quality_score THEN RAISE EXCEPTION 'Aluno não pode alterar score'; END IF;
  IF NEW.quality_checklist IS DISTINCT FROM OLD.quality_checklist THEN RAISE EXCEPTION 'Aluno não pode alterar quality_checklist'; END IF;
  IF NEW.structuring_attempts IS DISTINCT FROM OLD.structuring_attempts THEN RAISE EXCEPTION 'Aluno não pode alterar structuring_attempts'; END IF;
  IF NEW.last_structuring_at IS DISTINCT FROM OLD.last_structuring_at THEN RAISE EXCEPTION 'Aluno não pode alterar last_structuring_at'; END IF;
  IF NEW.last_structuring_error IS DISTINCT FROM OLD.last_structuring_error THEN RAISE EXCEPTION 'Aluno não pode alterar last_structuring_error'; END IF;
  IF NEW.estimated_duration_minutes IS DISTINCT FROM OLD.estimated_duration_minutes THEN RAISE EXCEPTION 'Aluno não pode alterar estimated_duration_minutes'; END IF;
  IF NEW.subtitle IS DISTINCT FROM OLD.subtitle THEN RAISE EXCEPTION 'Aluno não pode alterar subtitle'; END IF;

  RETURN NEW;
END;
$$;

-- 4) Trigger de publicação: exige checklist mínimo
CREATE OR REPLACE FUNCTION public.enforce_lesson_publish_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c jsonb;
BEGIN
  IF NEW.status = 'published' AND COALESCE(OLD.status, '') <> 'published' THEN
    c := COALESCE(NEW.quality_checklist, '{}'::jsonb);
    IF NOT (
      COALESCE((c->>'title_reviewed')::boolean, false)
      AND COALESCE((c->>'content_reviewed')::boolean, false)
      AND COALESCE((c->>'video_attached')::boolean, false)
      AND COALESCE((c->>'no_hallucination')::boolean, false)
      AND COALESCE((c->>'ready_to_publish')::boolean, false)
    ) THEN
      RAISE EXCEPTION 'Checklist mínimo de curadoria não preenchido (title_reviewed, content_reviewed, video_attached, no_hallucination, ready_to_publish)';
    END IF;
    IF NEW.video_url IS NULL OR length(trim(NEW.video_url)) = 0 THEN
      RAISE EXCEPTION 'Não é possível publicar sem vídeo anexado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_lesson_publish_checklist ON public.tutor_lesson_memory;
CREATE TRIGGER tr_enforce_lesson_publish_checklist
BEFORE UPDATE ON public.tutor_lesson_memory
FOR EACH ROW EXECUTE FUNCTION public.enforce_lesson_publish_checklist();

-- 5) Constraint de event_type oficial
ALTER TABLE public.tutor_lesson_events
  DROP CONSTRAINT IF EXISTS tutor_lesson_events_event_type_check;
ALTER TABLE public.tutor_lesson_events
  ADD CONSTRAINT tutor_lesson_events_event_type_check
  CHECK (event_type IN (
    'lesson_requested',
    'lesson_structuring_started',
    'lesson_structured',
    'lesson_structure_failed',
    'lesson_exported',
    'lesson_uploaded',
    'lesson_ready_to_publish',
    'lesson_published',
    'lesson_unpublished',
    'lesson_watched',
    'lesson_completed',
    'lesson_deleted',
    'lesson_restored'
  ));

-- 6) Índice para deduplicação rápida
CREATE INDEX IF NOT EXISTS idx_tutor_lesson_dedupe
  ON public.tutor_lesson_memory (user_id, source_session_id, topic, subject)
  WHERE status NOT IN ('deleted','rejected');

-- 7) actor_id em events: permitir NULL para inserts via service role (sistema)
ALTER TABLE public.tutor_lesson_events
  ALTER COLUMN actor_id DROP NOT NULL;
