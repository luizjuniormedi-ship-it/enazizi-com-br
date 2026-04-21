-- Fase 1.6 — Estruturar IDs no temas_estudados
ALTER TABLE public.temas_estudados
  ADD COLUMN IF NOT EXISTS subtopic_id uuid NULL REFERENCES public.curriculum_subtopics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic_id uuid NULL REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specialty_id uuid NULL REFERENCES public.curriculum_specialties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtopic_match_method text NULL;

CREATE INDEX IF NOT EXISTS idx_temas_estudados_subtopic_id  ON public.temas_estudados(subtopic_id);
CREATE INDEX IF NOT EXISTS idx_temas_estudados_topic_id     ON public.temas_estudados(topic_id);
CREATE INDEX IF NOT EXISTS idx_temas_estudados_specialty_id ON public.temas_estudados(specialty_id);

-- ── Backfill inicial (idempotente, apenas match exato) ──────────────
-- Passo 1: subtopic_id via subtopico → curriculum_subtopics.nome (exato, case-insensitive)
WITH candidatos AS (
  SELECT te.id AS te_id, s.id AS sub_id, s.topic_id, t.specialty_id
  FROM public.temas_estudados te
  JOIN public.curriculum_subtopics s
    ON lower(trim(s.nome)) = lower(trim(te.subtopico))
  JOIN public.curriculum_topics t ON t.id = s.topic_id
  WHERE te.subtopic_id IS NULL
    AND te.subtopico IS NOT NULL
    AND length(trim(te.subtopico)) > 0
)
UPDATE public.temas_estudados te
SET subtopic_id = c.sub_id,
    topic_id    = COALESCE(te.topic_id, c.topic_id),
    specialty_id = COALESCE(te.specialty_id, c.specialty_id),
    subtopic_match_method = 'subtopic_exact'
FROM candidatos c
WHERE c.te_id = te.id;

-- Passo 2: subtopic_id via tema → curriculum_subtopics.nome (quando o usuário botou subtema no campo tema)
WITH candidatos AS (
  SELECT te.id AS te_id, s.id AS sub_id, s.topic_id, t.specialty_id
  FROM public.temas_estudados te
  JOIN public.curriculum_subtopics s
    ON lower(trim(s.nome)) = lower(trim(te.tema))
  JOIN public.curriculum_topics t ON t.id = s.topic_id
  WHERE te.subtopic_id IS NULL
)
UPDATE public.temas_estudados te
SET subtopic_id = c.sub_id,
    topic_id    = COALESCE(te.topic_id, c.topic_id),
    specialty_id = COALESCE(te.specialty_id, c.specialty_id),
    subtopic_match_method = 'subtopic_via_tema'
FROM candidatos c
WHERE c.te_id = te.id;

-- Passo 3: topic_id via tema → curriculum_topics.nome (sem subtópico vinculado, apenas topic)
WITH candidatos AS (
  SELECT te.id AS te_id, t.id AS topic_id, t.specialty_id
  FROM public.temas_estudados te
  JOIN public.curriculum_topics t
    ON lower(trim(t.nome)) = lower(trim(te.tema))
  WHERE te.subtopic_id IS NULL
    AND te.topic_id IS NULL
)
UPDATE public.temas_estudados te
SET topic_id = c.topic_id,
    specialty_id = COALESCE(te.specialty_id, c.specialty_id),
    subtopic_match_method = 'topic_exact'
FROM candidatos c
WHERE c.te_id = te.id;

-- Passo 4: specialty_id via especialidade (preenche o que faltar)
WITH candidatos AS (
  SELECT te.id AS te_id, sp.id AS spec_id
  FROM public.temas_estudados te
  JOIN public.curriculum_specialties sp
    ON lower(trim(sp.nome)) = lower(trim(te.especialidade))
  WHERE te.specialty_id IS NULL
)
UPDATE public.temas_estudados te
SET specialty_id = c.spec_id
FROM candidatos c
WHERE c.te_id = te.id;