-- Sprint 3: cobertura curricular por banca (somente leitura/relatório)

-- 1) View
CREATE OR REPLACE VIEW public.v_curriculum_coverage_by_banca AS
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

COMMENT ON VIEW public.v_curriculum_coverage_by_banca IS
  'Sprint 3 — cobertura curricular por banca x subtopic (somente leitura, admin)';

-- 2) RPC agregada
CREATE OR REPLACE FUNCTION public.get_banca_coverage_report()
RETURNS TABLE(
  banca                text,
  specialties_total    int,
  specialties_cobertas int,
  topics_total         int,
  topics_cobertos      int,
  subtopics_total      int,
  subtopics_cobertos   int,
  microtopics_total    int,
  pct_specialties      numeric,
  pct_topics           numeric,
  pct_subtopics        numeric,
  peso_medio           numeric,
  status               text,
  top_gaps_specialties jsonb
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
  WITH base AS (
    SELECT v.banca, v.specialty_id, v.topic_id, v.subtopic_id,
           v.specialty_nome, v.has_weight, v.peso
    FROM public.v_curriculum_coverage_by_banca v
  ),
  agg AS (
    SELECT
      b.banca,
      COUNT(DISTINCT b.specialty_id)                                  AS specialties_total,
      COUNT(DISTINCT b.specialty_id) FILTER (WHERE b.has_weight)      AS specialties_cobertas,
      COUNT(DISTINCT b.topic_id)                                      AS topics_total,
      COUNT(DISTINCT b.topic_id) FILTER (WHERE b.has_weight)          AS topics_cobertos,
      COUNT(DISTINCT b.subtopic_id)                                   AS subtopics_total,
      COUNT(DISTINCT b.subtopic_id) FILTER (WHERE b.has_weight)       AS subtopics_cobertos,
      ROUND(AVG(b.peso) FILTER (WHERE b.has_weight)::numeric, 2)      AS peso_medio
    FROM base b
    GROUP BY b.banca
  ),
  gap_rows AS (
    SELECT bb.banca, bb.specialty_nome, COUNT(*) AS cnt,
           ROW_NUMBER() OVER (PARTITION BY bb.banca ORDER BY COUNT(*) DESC) AS rn
    FROM base bb
    WHERE NOT bb.has_weight
    GROUP BY bb.banca, bb.specialty_nome
  ),
  gaps AS (
    SELECT g.banca,
           jsonb_agg(
             jsonb_build_object('specialty', g.specialty_nome, 'subtopics_sem_peso', g.cnt)
             ORDER BY g.cnt DESC
           ) AS top_gaps
    FROM gap_rows g
    WHERE g.rn <= 5
    GROUP BY g.banca
  )
  SELECT
    a.banca,
    a.specialties_total,
    a.specialties_cobertas,
    a.topics_total,
    a.topics_cobertos,
    a.subtopics_total,
    a.subtopics_cobertos,
    (SELECT COUNT(*)::int FROM public.curriculum_microtopics m WHERE m.ativo) AS microtopics_total,
    ROUND(100.0 * a.specialties_cobertas / NULLIF(a.specialties_total,0), 2) AS pct_specialties,
    ROUND(100.0 * a.topics_cobertos      / NULLIF(a.topics_total,0), 2)      AS pct_topics,
    ROUND(100.0 * a.subtopics_cobertos   / NULLIF(a.subtopics_total,0), 2)   AS pct_subtopics,
    a.peso_medio,
    CASE
      WHEN ROUND(100.0 * a.subtopics_cobertos / NULLIF(a.subtopics_total,0), 2) >= 80
       AND ROUND(100.0 * a.specialties_cobertas / NULLIF(a.specialties_total,0), 2) >= 90
        THEN 'pronta'
      WHEN ROUND(100.0 * a.subtopics_cobertos / NULLIF(a.subtopics_total,0), 2) >= 40
        OR ROUND(100.0 * a.specialties_cobertas / NULLIF(a.specialties_total,0), 2) >= 60
        THEN 'parcial'
      ELSE 'nao_pronta'
    END AS status,
    COALESCE(g.top_gaps, '[]'::jsonb) AS top_gaps_specialties
  FROM agg a
  LEFT JOIN gaps g ON g.banca = a.banca
  ORDER BY a.banca;
END;
$$;

REVOKE ALL ON FUNCTION public.get_banca_coverage_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_banca_coverage_report() TO authenticated;