-- ============================================================
-- SPRINT 1: IDs estruturais em questions_bank e real_exam_questions
-- Schema-only. Sem backfill. Sem mudança em RLS. Sem mudança em dados.
-- ============================================================

-- ---------- questions_bank ----------
ALTER TABLE public.questions_bank
  ADD COLUMN IF NOT EXISTS specialty_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS topic_id       uuid NULL,
  ADD COLUMN IF NOT EXISTS subtopic_id    uuid NULL,
  ADD COLUMN IF NOT EXISTS microtopic_id  uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_bank_specialty_id_fkey') THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_specialty_id_fkey
      FOREIGN KEY (specialty_id) REFERENCES public.curriculum_specialties(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_bank_topic_id_fkey') THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_topic_id_fkey
      FOREIGN KEY (topic_id) REFERENCES public.curriculum_topics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_bank_subtopic_id_fkey') THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_subtopic_id_fkey
      FOREIGN KEY (subtopic_id) REFERENCES public.curriculum_subtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_bank_microtopic_id_fkey') THEN
    ALTER TABLE public.questions_bank
      ADD CONSTRAINT questions_bank_microtopic_id_fkey
      FOREIGN KEY (microtopic_id) REFERENCES public.curriculum_microtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_questions_bank_specialty_id  ON public.questions_bank(specialty_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank_topic_id      ON public.questions_bank(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank_subtopic_id   ON public.questions_bank(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank_microtopic_id ON public.questions_bank(microtopic_id);

-- ---------- real_exam_questions ----------
ALTER TABLE public.real_exam_questions
  ADD COLUMN IF NOT EXISTS specialty_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS topic_id       uuid NULL,
  ADD COLUMN IF NOT EXISTS subtopic_id    uuid NULL,
  ADD COLUMN IF NOT EXISTS microtopic_id  uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'real_exam_questions_specialty_id_fkey') THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_specialty_id_fkey
      FOREIGN KEY (specialty_id) REFERENCES public.curriculum_specialties(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'real_exam_questions_topic_id_fkey') THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_topic_id_fkey
      FOREIGN KEY (topic_id) REFERENCES public.curriculum_topics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'real_exam_questions_subtopic_id_fkey') THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_subtopic_id_fkey
      FOREIGN KEY (subtopic_id) REFERENCES public.curriculum_subtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'real_exam_questions_microtopic_id_fkey') THEN
    ALTER TABLE public.real_exam_questions
      ADD CONSTRAINT real_exam_questions_microtopic_id_fkey
      FOREIGN KEY (microtopic_id) REFERENCES public.curriculum_microtopics(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_real_exam_questions_specialty_id  ON public.real_exam_questions(specialty_id);
CREATE INDEX IF NOT EXISTS idx_real_exam_questions_topic_id      ON public.real_exam_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_real_exam_questions_subtopic_id   ON public.real_exam_questions(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_real_exam_questions_microtopic_id ON public.real_exam_questions(microtopic_id);