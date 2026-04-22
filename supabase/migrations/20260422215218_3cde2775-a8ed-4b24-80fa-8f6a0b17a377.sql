-- Sprint 1 (reaplicação de FKs ausentes)
-- Colunas e índices já existem. Apenas FKs foram detectadas como faltantes.
-- Idempotente: cada FK só é criada se ainda não existir.

DO $$
BEGIN
  -- questions_bank → curriculum_specialties
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_bank_specialty_id_fkey'
  ) THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_specialty_id_fkey
      FOREIGN KEY (specialty_id) REFERENCES public.curriculum_specialties(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- questions_bank → curriculum_topics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_bank_topic_id_fkey'
  ) THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_topic_id_fkey
      FOREIGN KEY (topic_id) REFERENCES public.curriculum_topics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- questions_bank → curriculum_subtopics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_bank_subtopic_id_fkey'
  ) THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_subtopic_id_fkey
      FOREIGN KEY (subtopic_id) REFERENCES public.curriculum_subtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- questions_bank → curriculum_microtopics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'questions_bank_microtopic_id_fkey'
  ) THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_microtopic_id_fkey
      FOREIGN KEY (microtopic_id) REFERENCES public.curriculum_microtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- real_exam_questions → curriculum_specialties
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_exam_questions_specialty_id_fkey'
  ) THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_specialty_id_fkey
      FOREIGN KEY (specialty_id) REFERENCES public.curriculum_specialties(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- real_exam_questions → curriculum_topics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_exam_questions_topic_id_fkey'
  ) THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_topic_id_fkey
      FOREIGN KEY (topic_id) REFERENCES public.curriculum_topics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- real_exam_questions → curriculum_subtopics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_exam_questions_subtopic_id_fkey'
  ) THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_subtopic_id_fkey
      FOREIGN KEY (subtopic_id) REFERENCES public.curriculum_subtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- real_exam_questions → curriculum_microtopics
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'real_exam_questions_microtopic_id_fkey'
  ) THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_microtopic_id_fkey
      FOREIGN KEY (microtopic_id) REFERENCES public.curriculum_microtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;