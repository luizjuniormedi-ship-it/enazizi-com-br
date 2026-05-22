ALTER TABLE public.teacher_study_assignments ADD COLUMN IF NOT EXISTS turma_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;
