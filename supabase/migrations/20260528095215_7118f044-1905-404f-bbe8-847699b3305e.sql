
-- ============================================================================
-- ENAZIZI — Bridge Layer Ontológica (Read-Only Views)
-- Freeze v25 — Zero impacto no runtime atual
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. v_question_semantic_map
--    Questão + specialty legacy + arrays agregados de nós ontológicos
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ontology.v_question_semantic_map
WITH (security_invoker = true) AS
SELECT
  q.id                  AS question_id,
  q.specialty_id        AS legacy_specialty_id,
  q.topic               AS legacy_topic,
  COALESCE(
    jsonb_object_agg(n.node_type, n.nodes) FILTER (WHERE n.node_type IS NOT NULL),
    '{}'::jsonb
  )                     AS semantic_axes,
  COALESCE(
    array_agg(DISTINCT l.ontology_version_id) FILTER (WHERE l.ontology_version_id IS NOT NULL),
    ARRAY[]::uuid[]
  )                     AS ontology_versions
FROM public.questions_bank q
LEFT JOIN ontology.question_semantic_links l ON l.question_id = q.id
LEFT JOIN LATERAL (
  SELECT
    cn.node_type,
    jsonb_agg(jsonb_build_object(
      'id',   cn.id,
      'name', cn.name,
      'slug', cn.slug,
      'semantic_status', cn.semantic_status
    ) ORDER BY cn.name) AS nodes
  FROM ontology.curriculum_nodes cn
  WHERE cn.id = l.node_id
  GROUP BY cn.node_type
) n ON true
GROUP BY q.id, q.specialty_id, q.topic;

GRANT SELECT ON ontology.v_question_semantic_map TO authenticated;
GRANT SELECT ON ontology.v_question_semantic_map TO service_role;

-- ----------------------------------------------------------------------------
-- 2. v_question_curriculum
--    Flat join: questão → specialty (legacy) + ontology node identifiers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ontology.v_question_curriculum
WITH (security_invoker = true) AS
SELECT
  q.id                                                          AS question_id,
  q.specialty_id                                                AS legacy_specialty_id,
  q.topic                                                       AS legacy_topic,
  MAX(CASE WHEN n.node_type = 'specialty'  THEN n.name END)     AS ontology_specialty,
  MAX(CASE WHEN n.node_type = 'domain'     THEN n.name END)     AS ontology_domain,
  MAX(CASE WHEN n.node_type = 'system'     THEN n.name END)     AS ontology_system,
  MAX(CASE WHEN n.node_type = 'disease'    THEN n.name END)     AS ontology_disease,
  MAX(CASE WHEN n.node_type = 'subtopic'   THEN n.name END)     AS ontology_subtopic
FROM public.questions_bank q
LEFT JOIN ontology.question_semantic_links l ON l.question_id = q.id
LEFT JOIN ontology.curriculum_nodes n ON n.id = l.node_id
GROUP BY q.id, q.specialty_id, q.topic;

GRANT SELECT ON ontology.v_question_curriculum TO authenticated;
GRANT SELECT ON ontology.v_question_curriculum TO service_role;

-- ----------------------------------------------------------------------------
-- 3. v_question_domains
--    Questão → array de domains
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ontology.v_question_domains
WITH (security_invoker = true) AS
SELECT
  q.id                                AS question_id,
  q.specialty_id                      AS legacy_specialty_id,
  COALESCE(
    array_agg(DISTINCT n.name) FILTER (WHERE n.node_type = 'domain'),
    ARRAY[]::text[]
  )                                   AS domains
FROM public.questions_bank q
LEFT JOIN ontology.question_semantic_links l ON l.question_id = q.id
LEFT JOIN ontology.curriculum_nodes n ON n.id = l.node_id AND n.node_type = 'domain'
GROUP BY q.id, q.specialty_id;

GRANT SELECT ON ontology.v_question_domains TO authenticated;
GRANT SELECT ON ontology.v_question_domains TO service_role;

-- ----------------------------------------------------------------------------
-- 4. v_question_cross_topics
--    Questão → cross_domains + knowledge_dimensions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ontology.v_question_cross_topics
WITH (security_invoker = true) AS
SELECT
  q.id                                                                                  AS question_id,
  q.specialty_id                                                                        AS legacy_specialty_id,
  COALESCE(array_agg(DISTINCT n.name) FILTER (WHERE n.node_type = 'cross_domain'),
           ARRAY[]::text[])                                                             AS cross_domains,
  COALESCE(array_agg(DISTINCT n.name) FILTER (WHERE n.node_type = 'knowledge_dimension'),
           ARRAY[]::text[])                                                             AS knowledge_dimensions
FROM public.questions_bank q
LEFT JOIN ontology.question_semantic_links l ON l.question_id = q.id
LEFT JOIN ontology.curriculum_nodes n ON n.id = l.node_id
  AND n.node_type IN ('cross_domain','knowledge_dimension')
GROUP BY q.id, q.specialty_id;

GRANT SELECT ON ontology.v_question_cross_topics TO authenticated;
GRANT SELECT ON ontology.v_question_cross_topics TO service_role;

-- ----------------------------------------------------------------------------
-- 5. v_unclassified_analysis — NULL como insight
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ontology.v_unclassified_analysis
WITH (security_invoker = true) AS
SELECT
  COALESCE(NULLIF(TRIM(q.topic), ''), '(sem topic)') AS topic,
  COUNT(*)                                           AS question_count,
  COUNT(*) FILTER (WHERE l.id IS NOT NULL)           AS with_semantic_link,
  COUNT(*) FILTER (WHERE l.id IS NULL)               AS without_semantic_link
FROM public.questions_bank q
LEFT JOIN ontology.question_semantic_links l ON l.question_id = q.id
WHERE q.specialty_id IS NULL
GROUP BY COALESCE(NULLIF(TRIM(q.topic), ''), '(sem topic)')
ORDER BY question_count DESC;

GRANT SELECT ON ontology.v_unclassified_analysis TO authenticated;
GRANT SELECT ON ontology.v_unclassified_analysis TO service_role;

-- ----------------------------------------------------------------------------
-- 6. v_transversal_domains — uso atual de cross_domain / knowledge_dimension
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ontology.v_transversal_domains
WITH (security_invoker = true) AS
SELECT
  n.id                  AS node_id,
  n.node_type           AS node_type,
  n.name                AS node_name,
  n.semantic_status     AS semantic_status,
  COUNT(l.id)           AS question_links,
  COUNT(DISTINCT l.question_id) AS distinct_questions
FROM ontology.curriculum_nodes n
LEFT JOIN ontology.question_semantic_links l ON l.node_id = n.id
WHERE n.node_type IN ('cross_domain','knowledge_dimension')
GROUP BY n.id, n.node_type, n.name, n.semantic_status
ORDER BY question_links DESC, n.name;

GRANT SELECT ON ontology.v_transversal_domains TO authenticated;
GRANT SELECT ON ontology.v_transversal_domains TO service_role;

-- ----------------------------------------------------------------------------
-- 7. v_pending_curriculum_rfc — topics NULL agregados (RFC candidates)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW ontology.v_pending_curriculum_rfc
WITH (security_invoker = true) AS
SELECT
  COALESCE(NULLIF(TRIM(q.topic), ''), '(sem topic)')   AS topic_label,
  COUNT(*)                                             AS question_count,
  MIN(q.created_at)                                    AS first_seen_at,
  MAX(q.created_at)                                    AS last_seen_at,
  EXISTS (
    SELECT 1 FROM ontology.pending_semantic_review psr
    WHERE psr.question_id = ANY (array_agg(q.id))
      AND psr.review_status = 'pending'
  )                                                    AS has_pending_review
FROM public.questions_bank q
WHERE q.specialty_id IS NULL
GROUP BY COALESCE(NULLIF(TRIM(q.topic), ''), '(sem topic)')
HAVING COUNT(*) >= 5
ORDER BY question_count DESC;

GRANT SELECT ON ontology.v_pending_curriculum_rfc TO authenticated;
GRANT SELECT ON ontology.v_pending_curriculum_rfc TO service_role;

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
-- DROP VIEW IF EXISTS ontology.v_pending_curriculum_rfc;
-- DROP VIEW IF EXISTS ontology.v_transversal_domains;
-- DROP VIEW IF EXISTS ontology.v_unclassified_analysis;
-- DROP VIEW IF EXISTS ontology.v_question_cross_topics;
-- DROP VIEW IF EXISTS ontology.v_question_domains;
-- DROP VIEW IF EXISTS ontology.v_question_curriculum;
-- DROP VIEW IF EXISTS ontology.v_question_semantic_map;
