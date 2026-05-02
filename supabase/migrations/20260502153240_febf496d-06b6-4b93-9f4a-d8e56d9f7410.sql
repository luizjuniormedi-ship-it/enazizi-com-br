
-- 1) status com 'ready_to_publish'
ALTER TABLE public.tutor_lesson_memory
  DROP CONSTRAINT IF EXISTS tutor_lesson_memory_status_check;
ALTER TABLE public.tutor_lesson_memory
  ADD CONSTRAINT tutor_lesson_memory_status_check
  CHECK (status IN (
    'pending_review','in_production','needs_adjustment',
    'ready_to_publish','published','unpublished',
    'archived','rejected','deleted'
  ));

-- 2) Remover policies antigas
DROP POLICY IF EXISTS "Students can view their own non-deleted lessons" ON public.tutor_lesson_memory;
DROP POLICY IF EXISTS "Admins can view all lessons" ON public.tutor_lesson_memory;
DROP POLICY IF EXISTS "Admins can insert lessons" ON public.tutor_lesson_memory;
DROP POLICY IF EXISTS "Admins can update lessons" ON public.tutor_lesson_memory;
DROP POLICY IF EXISTS "Students can request lessons" ON public.tutor_lesson_memory;
DROP POLICY IF EXISTS "Users can track their own progress" ON public.tutor_lesson_progress;

-- 3) Helper staff (sem super_admin que não existe no enum)
CREATE OR REPLACE FUNCTION public.is_lesson_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'professor'::app_role)
    OR public.has_role(_user_id, 'coordinator'::app_role)
    OR public.has_role(_user_id, 'institutional_admin'::app_role);
$$;

-- 4) Policies tutor_lesson_memory
CREATE POLICY "lesson_select_student_published"
ON public.tutor_lesson_memory FOR SELECT
USING (
  auth.uid() = user_id
  AND status = 'published'
  AND hidden_from_student = false
  AND deleted_at IS NULL
);

CREATE POLICY "lesson_select_student_own_request"
ON public.tutor_lesson_memory FOR SELECT
USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "lesson_select_staff_all"
ON public.tutor_lesson_memory FOR SELECT
USING (public.is_lesson_staff(auth.uid()));

CREATE POLICY "lesson_insert_student_request"
ON public.tutor_lesson_memory FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending_review'
  AND video_url IS NULL
  AND published_at IS NULL
  AND teacher_id IS NULL
  AND hidden_from_student = false
  AND hard_deleted = false
);

CREATE POLICY "lesson_insert_staff"
ON public.tutor_lesson_memory FOR INSERT
WITH CHECK (public.is_lesson_staff(auth.uid()));

CREATE POLICY "lesson_update_staff"
ON public.tutor_lesson_memory FOR UPDATE
USING (public.is_lesson_staff(auth.uid()))
WITH CHECK (public.is_lesson_staff(auth.uid()));

CREATE POLICY "lesson_delete_admin"
ON public.tutor_lesson_memory FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) Trigger de proteção de campos administrativos
CREATE OR REPLACE FUNCTION public.protect_tutor_lesson_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_lesson_staff(auth.uid()) THEN RETURN NEW; END IF;
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_tutor_lesson_admin_fields ON public.tutor_lesson_memory;
CREATE TRIGGER tr_protect_tutor_lesson_admin_fields
BEFORE UPDATE ON public.tutor_lesson_memory
FOR EACH ROW EXECUTE FUNCTION public.protect_tutor_lesson_admin_fields();

-- 6) Policies tutor_lesson_progress
CREATE POLICY "lesson_progress_select_own"
ON public.tutor_lesson_progress FOR SELECT
USING (auth.uid() = user_id OR public.is_lesson_staff(auth.uid()));

CREATE POLICY "lesson_progress_insert_own"
ON public.tutor_lesson_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lesson_progress_update_own"
ON public.tutor_lesson_progress FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 7) Policies tutor_lesson_events
DROP POLICY IF EXISTS "lesson_events_select_staff" ON public.tutor_lesson_events;
DROP POLICY IF EXISTS "lesson_events_insert_self" ON public.tutor_lesson_events;

CREATE POLICY "lesson_events_select_staff"
ON public.tutor_lesson_events FOR SELECT
USING (public.is_lesson_staff(auth.uid()) OR auth.uid() = actor_id);

CREATE POLICY "lesson_events_insert_self"
ON public.tutor_lesson_events FOR INSERT
WITH CHECK (auth.uid() = actor_id);

-- 8) STORAGE: bucket privado + limites
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY[
    'video/mp4','video/webm','video/quicktime','video/x-matroska','video/x-msvideo'
  ]
WHERE id = 'tutor-lesson-videos';

DROP POLICY IF EXISTS "Admins can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Students can read videos" ON storage.objects;
DROP POLICY IF EXISTS "tutor_lesson_videos_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "tutor_lesson_videos_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "tutor_lesson_videos_staff_delete" ON storage.objects;
DROP POLICY IF EXISTS "tutor_lesson_videos_staff_select" ON storage.objects;

CREATE POLICY "tutor_lesson_videos_staff_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tutor-lesson-videos' AND public.is_lesson_staff(auth.uid()));

CREATE POLICY "tutor_lesson_videos_staff_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'tutor-lesson-videos' AND public.is_lesson_staff(auth.uid()));

CREATE POLICY "tutor_lesson_videos_staff_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'tutor-lesson-videos' AND public.is_lesson_staff(auth.uid()));

CREATE POLICY "tutor_lesson_videos_staff_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'tutor-lesson-videos' AND public.is_lesson_staff(auth.uid()));
