-- 1) Backfill importance_level a partir de peso
UPDATE public.curriculum_weights
SET importance_level = CASE
  WHEN peso >= 9 THEN 'muito_cobrado'
  WHEN peso >= 7 THEN 'cobrado'
  WHEN peso >= 5 THEN 'pouco_cobrado'
  ELSE 'raro'
END
WHERE importance_level IS NULL;

-- 2) Backfill incidence_weight (0..1) a partir de peso, só onde está zerado/nulo
UPDATE public.curriculum_weights
SET incidence_weight = ROUND((peso::numeric / 10.0)::numeric, 2)
WHERE incidence_weight IS NULL OR incidence_weight = 0;

-- 3) Backfill frequency_score (0..1) com mesma derivação inicial; será refinado quando tivermos contagem real de questões
UPDATE public.curriculum_weights
SET frequency_score = ROUND((peso::numeric / 10.0)::numeric, 2)
WHERE frequency_score IS NULL OR frequency_score = 0;

-- 4) Notes auditáveis para registrar a origem do backfill, só onde notes está vazio
UPDATE public.curriculum_weights
SET notes = COALESCE(notes, '') || '[backfill v1.1: importance/incidence/frequency derivados de peso]'
WHERE notes IS NULL OR notes = '';

-- 5) Índice para acelerar lookups de duplicatas em question_topic_links
CREATE INDEX IF NOT EXISTS idx_qtl_question_lookup
  ON public.question_topic_links (question_source, question_id);

-- 6) Índice em curriculum_subtopics(nome) e curriculum_topics(nome) para matching textual
CREATE INDEX IF NOT EXISTS idx_curriculum_subtopics_nome_lower
  ON public.curriculum_subtopics (LOWER(nome));
CREATE INDEX IF NOT EXISTS idx_curriculum_topics_nome_lower
  ON public.curriculum_topics (LOWER(nome));

-- 7) View de apoio: contagem de questões por subtopic (via links já existentes)
CREATE OR REPLACE VIEW public.v_subtopic_question_density AS
SELECT
  cs.id AS subtopic_id,
  cs.nome AS subtopic_nome,
  ct.nome AS topic_nome,
  csp.nome AS specialty_nome,
  COUNT(qtl.id) AS questions_count
FROM public.curriculum_subtopics cs
JOIN public.curriculum_topics ct ON ct.id = cs.topic_id
JOIN public.curriculum_specialties csp ON csp.id = ct.specialty_id
LEFT JOIN public.question_topic_links qtl ON qtl.subtopic_id = cs.id
WHERE cs.ativo = true
GROUP BY cs.id, cs.nome, ct.nome, csp.nome;

GRANT SELECT ON public.v_subtopic_question_density TO authenticated, anon;