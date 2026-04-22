-- Sprint 3 fix: view com security_invoker (não atua como o dono)
CREATE OR REPLACE VIEW public.v_curriculum_coverage_by_banca
WITH (security_invoker = true) AS
WITH all_bancas AS (
  SELECT DISTINCT banca FROM public.curriculum_weights
),
hier AS (
  SELECT
    sp.id AS specialty_id, sp.nome AS specialty_nome,
    t.id  AS topic_id,     t.nome  AS topic_nome,
    s.id  AS subtopic_id,  s.nome  AS subtopic_nome
  FROM public.curriculum_specialties sp
  JOIN public.curriculum_topics t    ON t.specialty_id = sp.id AND t.ativo
  JOIN public.curriculum_subtopics s ON s.topic_id = t.id AND s.ativo
  WHERE sp.ativo
)
SELECT
  b.banca,
  h.specialty_id, h.specialty_nome,
  h.topic_id,     h.topic_nome,
  h.subtopic_id,  h.subtopic_nome,
  cw.peso, cw.importance_level, cw.frequency_score,
  (cw.id IS NOT NULL) AS has_weight
FROM all_bancas b
CROSS JOIN hier h
LEFT JOIN public.curriculum_weights cw
  ON cw.banca = b.banca AND cw.subtopic_id = h.subtopic_id;