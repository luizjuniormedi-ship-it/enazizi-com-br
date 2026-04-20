DROP VIEW IF EXISTS public.v_subtopic_question_density;

CREATE VIEW public.v_subtopic_question_density
WITH (security_invoker = true) AS
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