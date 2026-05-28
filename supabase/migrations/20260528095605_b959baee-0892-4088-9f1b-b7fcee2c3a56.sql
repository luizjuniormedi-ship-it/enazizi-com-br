-- ENAZIZI — GOVERNANCE OF CONSUMPTION (Freeze v25)

CREATE OR REPLACE VIEW ontology.v_active_ontology_version
WITH (security_invoker = true) AS
SELECT
  id,
  version_name AS slug,
  active,
  created_at,
  'v25.1'::text AS semantic_contract_version
FROM ontology.ontology_versions
WHERE active = true;

GRANT SELECT ON ontology.v_active_ontology_version TO authenticated, service_role;

COMMENT ON VIEW ontology.v_active_ontology_version IS
'Governance: single source of truth for the currently active ontology version. Consumers MUST declare and validate the ontology_version they support; never consume active=true implicitly.';

CREATE OR REPLACE VIEW ontology.v_semantic_drift
WITH (security_invoker = true) AS
WITH active_version AS (
  SELECT id FROM ontology.ontology_versions WHERE active = true LIMIT 1
),
question_specialty_links AS (
  SELECT
    qsl.question_id,
    qsl.node_id,
    qsl.ontology_version_id,
    lower(cn.name) AS node_name_norm,
    cn.deprecated_at
  FROM ontology.question_semantic_links qsl
  JOIN ontology.curriculum_nodes cn ON cn.id = qsl.node_id
  WHERE qsl.review_status = 'approved'
    AND cn.node_type = 'specialty'
),
aggregated AS (
  SELECT
    qb.id AS question_id,
    qb.specialty_id AS legacy_specialty_id,
    lower(cs.nome) AS legacy_specialty_name_norm,
    COUNT(qsl.node_id) AS ontology_specialty_count,
    ARRAY_AGG(DISTINCT qsl.node_name_norm) FILTER (WHERE qsl.node_name_norm IS NOT NULL) AS ontology_specialty_names,
    BOOL_OR(qsl.deprecated_at IS NOT NULL) AS has_deprecated_node,
    BOOL_OR(qsl.ontology_version_id <> (SELECT id FROM active_version)) AS has_version_mismatch
  FROM public.questions_bank qb
  LEFT JOIN public.curriculum_specialties cs ON cs.id = qb.specialty_id
  LEFT JOIN question_specialty_links qsl ON qsl.question_id = qb.id
  GROUP BY qb.id, qb.specialty_id, cs.nome
)
SELECT
  question_id,
  legacy_specialty_id,
  legacy_specialty_name_norm AS legacy_specialty_name,
  ontology_specialty_count,
  ontology_specialty_names,
  has_deprecated_node,
  has_version_mismatch,
  CASE
    WHEN ontology_specialty_count > 1                                          THEN 'multiple_specialty_links'
    WHEN has_deprecated_node                                                    THEN 'deprecated_node_link'
    WHEN has_version_mismatch                                                   THEN 'version_mismatch'
    WHEN legacy_specialty_name_norm IS NOT NULL
         AND ontology_specialty_count = 1
         AND NOT (legacy_specialty_name_norm = ANY(ontology_specialty_names)) THEN 'specialty_mismatch'
    ELSE 'no_drift'
  END AS drift_type
FROM aggregated
WHERE
     ontology_specialty_count > 1
  OR has_deprecated_node
  OR has_version_mismatch
  OR (
       legacy_specialty_name_norm IS NOT NULL
       AND ontology_specialty_count = 1
       AND NOT (legacy_specialty_name_norm = ANY(ontology_specialty_names))
     );

GRANT SELECT ON ontology.v_semantic_drift TO authenticated, service_role;

COMMENT ON VIEW ontology.v_semantic_drift IS
'Governance: read-only drift detector between legacy runtime (questions_bank.specialty_id) and ontology specialty links. No auto-correction. Surface for RFC review only.';

-- DOWN:
-- DROP VIEW IF EXISTS ontology.v_semantic_drift;
-- DROP VIEW IF EXISTS ontology.v_active_ontology_version;