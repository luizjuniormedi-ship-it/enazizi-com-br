-- View 1: cobertura do BANCO DE QUESTÕES por banca (separada de currículo)
CREATE OR REPLACE VIEW public.v_banca_question_coverage AS
WITH banca_questions AS (
  -- questions_bank → exam_banks.banca
  SELECT eb.banca,
         qb.id AS question_id,
         qb.specialty_id,
         qb.topic_id,
         qb.subtopic_id,
         qb.microtopic_id,
         'questions_bank'::text AS source_table
  FROM public.exam_banks eb
  JOIN public.questions_bank qb ON qb.exam_bank_id = eb.id
  WHERE eb.banca IS NOT NULL

  UNION ALL

  -- real_exam_questions → match textual em exam_info
  SELECT
    CASE
      WHEN req.exam_info ILIKE '%enare%'    THEN 'ENARE'
      WHEN req.exam_info ILIKE '%unifesp%'  THEN 'UNIFESP'
      WHEN req.exam_info ILIKE '%unicamp%'  THEN 'UNICAMP'
      WHEN req.exam_info ILIKE '%sus-sp%' OR req.exam_info ILIKE '%sus sp%' THEN 'SUS-SP'
      WHEN req.exam_info ILIKE '%revalida%' THEN 'REVALIDA'
      WHEN req.exam_info ILIKE '%usp%'      THEN 'USP'
      ELSE NULL
    END AS banca,
    req.id, req.specialty_id, req.topic_id, req.subtopic_id, req.microtopic_id,
    'real_exam_questions'::text
  FROM public.real_exam_questions req
  WHERE req.is_active = true
    AND req.exam_info IS NOT NULL
)
SELECT
  banca,
  COUNT(*)                                              AS total_questoes,
  COUNT(specialty_id)                                   AS classificadas_specialty,
  COUNT(topic_id)                                       AS classificadas_topic,
  COUNT(subtopic_id)                                    AS classificadas_subtopic,
  COUNT(*) FILTER (WHERE source_table='questions_bank') AS de_questions_bank,
  COUNT(*) FILTER (WHERE source_table='real_exam_questions') AS de_real_exam,
  ROUND(100.0 * COUNT(specialty_id)::numeric / NULLIF(COUNT(*),0), 2) AS pct_classificadas
FROM banca_questions
WHERE banca IS NOT NULL
GROUP BY banca;

COMMENT ON VIEW public.v_banca_question_coverage IS
  'Sprint 3 — cobertura do BANCO DE QUESTÕES por banca. Não mede currículo. Inclui questions_bank (FK exam_banks) e real_exam_questions (match textual em exam_info).';

-- Função 2: prontidão consolidada (admin only)
CREATE OR REPLACE FUNCTION public.get_banca_generator_readiness()
RETURNS TABLE (
  banca text,
  -- currículo
  specialties_total int,
  specialties_cobertas int,
  topics_total int,
  topics_cobertos int,
  subtopics_total int,
  subtopics_cobertos int,
  pct_subtopics numeric,
  curriculum_status text,
  -- questões
  total_questoes bigint,
  questoes_classificadas bigint,
  pct_questoes_classificadas numeric,
  questions_status text,
  -- final
  generator_status text,
  generator_status_reason text,
  highlight boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH bancas AS (
    SELECT DISTINCT b FROM (
      SELECT DISTINCT banca AS b FROM public.curriculum_weights
      UNION ALL
      SELECT DISTINCT banca FROM public.v_banca_question_coverage WHERE banca IS NOT NULL
      UNION ALL
      VALUES ('ENARE'),('USP'),('UNIFESP'),('SUS-SP'),('UNICAMP'),('REVALIDA'),('GERAL')
    ) x WHERE b IS NOT NULL
  ),
  curr AS (
    SELECT v.banca,
           COUNT(DISTINCT v.specialty_id)::int                                AS specialties_total,
           COUNT(DISTINCT v.specialty_id) FILTER (WHERE v.has_weight)::int    AS specialties_cobertas,
           COUNT(DISTINCT v.topic_id)::int                                    AS topics_total,
           COUNT(DISTINCT v.topic_id) FILTER (WHERE v.has_weight)::int        AS topics_cobertos,
           COUNT(DISTINCT v.subtopic_id)::int                                 AS subtopics_total,
           COUNT(DISTINCT v.subtopic_id) FILTER (WHERE v.has_weight)::int     AS subtopics_cobertos
    FROM public.v_curriculum_coverage_by_banca v
    GROUP BY v.banca
  ),
  q AS (
    SELECT * FROM public.v_banca_question_coverage
  )
  SELECT
    b.b AS banca,
    COALESCE(c.specialties_total, 0),
    COALESCE(c.specialties_cobertas, 0),
    COALESCE(c.topics_total, 0),
    COALESCE(c.topics_cobertos, 0),
    COALESCE(c.subtopics_total, 0),
    COALESCE(c.subtopics_cobertos, 0),
    ROUND(100.0 * COALESCE(c.subtopics_cobertos,0)::numeric
                  / NULLIF(c.subtopics_total,0), 2) AS pct_subtopics,
    CASE
      WHEN c.subtopics_total IS NULL OR c.subtopics_total = 0 THEN 'nao_pronta'
      WHEN c.subtopics_cobertos::numeric / c.subtopics_total >= 0.8
       AND c.specialties_cobertas::numeric / NULLIF(c.specialties_total,1) >= 0.9 THEN 'pronta'
      WHEN c.subtopics_cobertos::numeric / c.subtopics_total >= 0.4
        OR c.specialties_cobertas::numeric / NULLIF(c.specialties_total,1) >= 0.6 THEN 'parcial'
      ELSE 'nao_pronta'
    END AS curriculum_status,

    COALESCE(q.total_questoes, 0),
    COALESCE(q.classificadas_specialty, 0),
    ROUND(100.0 * COALESCE(q.classificadas_specialty,0)::numeric
                  / NULLIF(q.total_questoes,0), 2) AS pct_questoes_classificadas,
    CASE
      WHEN COALESCE(q.total_questoes,0) = 0 THEN 'sem_questoes'
      WHEN COALESCE(q.classificadas_specialty,0)::numeric / NULLIF(q.total_questoes,0) >= 0.7 THEN 'pronta'
      WHEN COALESCE(q.classificadas_specialty,0)::numeric / NULLIF(q.total_questoes,0) >= 0.3 THEN 'parcial'
      ELSE 'nao_pronta'
    END AS questions_status,

    -- generator_status: precisa AMBOS prontos
    CASE
      WHEN c.subtopics_total IS NULL OR c.subtopics_total = 0 THEN 'nao_pronta'
      WHEN COALESCE(q.total_questoes,0) = 0 THEN 'so_curriculo'
      WHEN c.subtopics_cobertos::numeric / c.subtopics_total >= 0.8
       AND COALESCE(q.classificadas_specialty,0)::numeric / NULLIF(q.total_questoes,0) >= 0.7 THEN 'pronta'
      WHEN c.subtopics_cobertos::numeric / c.subtopics_total >= 0.4
        OR COALESCE(q.classificadas_specialty,0)::numeric / NULLIF(q.total_questoes,0) >= 0.3 THEN 'parcial'
      ELSE 'nao_pronta'
    END AS generator_status,

    CASE
      WHEN c.subtopics_total IS NULL OR c.subtopics_total = 0
        THEN 'sem currículo mapeado'
      WHEN COALESCE(q.total_questoes,0) = 0
        THEN 'currículo OK, mas sem questões vinculadas à banca'
      WHEN COALESCE(q.classificadas_specialty,0) = 0
        THEN 'há questões mas nenhuma classificada hierarquicamente (rodar Sprint 2)'
      WHEN c.subtopics_cobertos::numeric / NULLIF(c.subtopics_total,1) < 0.8
        THEN 'currículo incompleto (<80% subtopics com peso)'
      WHEN COALESCE(q.classificadas_specialty,0)::numeric / NULLIF(q.total_questoes,0) < 0.7
        THEN 'classificação de questões insuficiente (<70%)'
      ELSE 'pronta para gerador granular'
    END AS generator_status_reason,

    (b.b IN ('ENARE','USP','UNIFESP','SUS-SP','UNICAMP','REVALIDA','GERAL')) AS highlight
  FROM bancas b
  LEFT JOIN curr c ON c.banca = b.b
  LEFT JOIN q    ON q.banca = b.b
  ORDER BY
    CASE WHEN b.b IN ('ENARE','USP','UNIFESP','SUS-SP','UNICAMP','REVALIDA','GERAL') THEN 0 ELSE 1 END,
    b.b;
END;
$$;

COMMENT ON FUNCTION public.get_banca_generator_readiness IS
  'Sprint 3 — relatório consolidado de prontidão por banca: currículo + questões + status final do gerador. Admin only.';

GRANT EXECUTE ON FUNCTION public.get_banca_generator_readiness TO authenticated;