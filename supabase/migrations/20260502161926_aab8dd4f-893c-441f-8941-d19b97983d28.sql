-- Permite que qualquer aluno autenticado veja todas as aulas publicadas (não apenas as próprias)
DROP POLICY IF EXISTS lesson_select_published_all ON public.tutor_lesson_memory;

CREATE POLICY lesson_select_published_all
ON public.tutor_lesson_memory
FOR SELECT
TO authenticated
USING (
  status = 'published'
  AND hidden_from_student = false
  AND deleted_at IS NULL
);