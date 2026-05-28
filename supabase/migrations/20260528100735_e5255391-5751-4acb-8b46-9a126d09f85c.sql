
-- =========================================================================
-- ONTOLOGY: Semantic Resolution Status Layer
-- Freeze v25 — parallel, opt-in, zero runtime impact
-- =========================================================================

-- ---- Catalog of resolution types -----------------------------------------
CREATE TABLE IF NOT EXISTS ontology.resolution_type_catalog (
  resolution_type text PRIMARY KEY,
  description     text NOT NULL,
  requires_rfc    boolean NOT NULL DEFAULT false,
  requires_human_review boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON ontology.resolution_type_catalog TO authenticated;
GRANT ALL    ON ontology.resolution_type_catalog TO service_role;

ALTER TABLE ontology.resolution_type_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_read_auth"
  ON ontology.resolution_type_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "catalog_write_service"
  ON ontology.resolution_type_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO ontology.resolution_type_catalog (resolution_type, description, requires_rfc, requires_human_review) VALUES
  ('pending_curriculum_rfc',     'Specialty inexistente na matriz curricular oficial', true,  false),
  ('transversal_domain',         'Tema que pertence a múltiplas áreas (domínio transversal)', false, false),
  ('semantic_noise',             'Topic genérico/ruidoso sem significado curricular', false, false),
  ('requires_human_review',      'Caso ambíguo que exige revisão humana', false, true),
  ('legacy_unmapped',            'Histórico não revisado, ainda sem classificação semântica', false, false),
  ('cross_domain_condition',     'Condição clínica que cruza múltiplos domínios formais', false, false),
  ('subtopic_without_parent',    'Subtema válido cuja specialty pai ainda não existe', true,  false),
  ('deprecated_curriculum_term', 'Termo curricular legado, descontinuado', false, false)
ON CONFLICT (resolution_type) DO NOTHING;

-- ---- Resolution status table ---------------------------------------------
CREATE TABLE IF NOT EXISTS ontology.semantic_resolution_status (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id                 uuid NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  resolution_type             text NOT NULL REFERENCES ontology.resolution_type_catalog(resolution_type),
  proposed_specialty_node_id  uuid NULL,
  proposed_domain_node_id     uuid NULL,
  confidence                  numeric NULL,
  requires_rfc                boolean NOT NULL DEFAULT false,
  requires_human_review       boolean NOT NULL DEFAULT false,
  resolution_source           text NOT NULL DEFAULT 'deterministic_topic_match',
  reviewed_by                 uuid NULL,
  reviewed_at                 timestamptz NULL,
  approved                    boolean NULL,
  notes                       text NULL,
  ontology_version_id         uuid NOT NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, ontology_version_id)
);

CREATE INDEX IF NOT EXISTS idx_srs_question      ON ontology.semantic_resolution_status(question_id);
CREATE INDEX IF NOT EXISTS idx_srs_type          ON ontology.semantic_resolution_status(resolution_type);
CREATE INDEX IF NOT EXISTS idx_srs_version       ON ontology.semantic_resolution_status(ontology_version_id);
CREATE INDEX IF NOT EXISTS idx_srs_requires_rfc  ON ontology.semantic_resolution_status(requires_rfc) WHERE requires_rfc = true;
CREATE INDEX IF NOT EXISTS idx_srs_human_review  ON ontology.semantic_resolution_status(requires_human_review) WHERE requires_human_review = true;

GRANT SELECT ON ontology.semantic_resolution_status TO authenticated;
GRANT ALL    ON ontology.semantic_resolution_status TO service_role;

ALTER TABLE ontology.semantic_resolution_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "srs_read_auth"
  ON ontology.semantic_resolution_status FOR SELECT TO authenticated USING (true);

CREATE POLICY "srs_write_service"
  ON ontology.semantic_resolution_status FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Block reviewer-field mutations from non-service callers (append-mostly)
CREATE OR REPLACE FUNCTION ontology.block_srs_review_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ontology, public
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'semantic_resolution_status review fields can only be updated by service_role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_srs_block_review_update ON ontology.semantic_resolution_status;
CREATE TRIGGER trg_srs_block_review_update
  BEFORE UPDATE ON ontology.semantic_resolution_status
  FOR EACH ROW EXECUTE FUNCTION ontology.block_srs_review_mutation();

-- =========================================================================
-- DETERMINISTIC SEEDER (no AI, no heuristic, no fuzzy matching)
-- =========================================================================
CREATE OR REPLACE FUNCTION ontology.seed_resolution_status_for_nulls()
RETURNS TABLE(inserted_count int, version_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ontology, public
AS $$
DECLARE
  v_version_id uuid;
  v_inserted   int := 0;
BEGIN
  -- Resolve active ontology version
  SELECT id INTO v_version_id
  FROM ontology.ontology_versions
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'No active ontology version found';
  END IF;

  -- Deterministic exact-topic mapping table (CTE)
  WITH topic_map(topic_lower, resolution_type) AS (
    VALUES
      ('anestesiologia',     'pending_curriculum_rfc'),
      ('radiologia',         'pending_curriculum_rfc'),
      ('nutrição',           'pending_curriculum_rfc'),
      ('nutricao',           'pending_curriculum_rfc'),
      ('geral',              'semantic_noise'),
      ('diagnóstico',        'semantic_noise'),
      ('diagnostico',        'semantic_noise'),
      ('tratamento',         'semantic_noise'),
      ('clínica médica',     'transversal_domain'),
      ('clinica medica',     'transversal_domain'),
      ('hemostasia',         'transversal_domain'),
      ('tep',                'cross_domain_condition'),
      ('aterosclerose',      'subtopic_without_parent'),
      ('cirurgia cardíaca',  'requires_human_review'),
      ('cirurgia cardiaca',  'requires_human_review')
  ),
  classified AS (
    SELECT
      q.id AS question_id,
      COALESCE(tm.resolution_type, 'legacy_unmapped') AS resolution_type
    FROM public.questions_bank q
    LEFT JOIN topic_map tm
      ON tm.topic_lower = lower(trim(q.topic))
    WHERE q.specialty_id IS NULL
  ),
  ins AS (
    INSERT INTO ontology.semantic_resolution_status
      (question_id, resolution_type, requires_rfc, requires_human_review,
       resolution_source, ontology_version_id)
    SELECT
      c.question_id,
      c.resolution_type,
      cat.requires_rfc,
      cat.requires_human_review,
      'deterministic_topic_match',
      v_version_id
    FROM classified c
    JOIN ontology.resolution_type_catalog cat USING (resolution_type)
    ON CONFLICT (question_id, ontology_version_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;

  RETURN QUERY SELECT v_inserted, v_version_id;
END;
$$;

REVOKE ALL ON FUNCTION ontology.seed_resolution_status_for_nulls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ontology.seed_resolution_status_for_nulls() TO service_role;

-- =========================================================================
-- ANALYTICS VIEWS (read-only)
-- =========================================================================
CREATE OR REPLACE VIEW ontology.v_resolution_backlog AS
SELECT
  resolution_type,
  count(*) AS question_count,
  count(*) FILTER (WHERE requires_rfc) AS rfc_pending,
  count(*) FILTER (WHERE requires_human_review) AS human_review_pending,
  count(*) FILTER (WHERE approved IS NULL) AS unreviewed
FROM ontology.semantic_resolution_status
GROUP BY resolution_type
ORDER BY question_count DESC;

CREATE OR REPLACE VIEW ontology.v_pending_rfc_domains AS
SELECT
  lower(trim(q.topic)) AS topic_normalized,
  q.topic              AS topic_original,
  count(*)             AS question_count
FROM ontology.semantic_resolution_status s
JOIN public.questions_bank q ON q.id = s.question_id
WHERE s.resolution_type = 'pending_curriculum_rfc'
GROUP BY lower(trim(q.topic)), q.topic
ORDER BY question_count DESC;

CREATE OR REPLACE VIEW ontology.v_transversal_topics AS
SELECT
  lower(trim(q.topic)) AS topic_normalized,
  count(*)             AS question_count
FROM ontology.semantic_resolution_status s
JOIN public.questions_bank q ON q.id = s.question_id
WHERE s.resolution_type = 'transversal_domain'
GROUP BY lower(trim(q.topic))
ORDER BY question_count DESC;

CREATE OR REPLACE VIEW ontology.v_semantic_noise AS
SELECT
  lower(trim(q.topic)) AS topic_normalized,
  count(*)             AS question_count
FROM ontology.semantic_resolution_status s
JOIN public.questions_bank q ON q.id = s.question_id
WHERE s.resolution_type = 'semantic_noise'
GROUP BY lower(trim(q.topic))
ORDER BY question_count DESC;

CREATE OR REPLACE VIEW ontology.v_cross_domain_candidates AS
SELECT
  lower(trim(q.topic)) AS topic_normalized,
  count(*)             AS question_count
FROM ontology.semantic_resolution_status s
JOIN public.questions_bank q ON q.id = s.question_id
WHERE s.resolution_type IN ('cross_domain_condition', 'subtopic_without_parent')
GROUP BY lower(trim(q.topic))
ORDER BY question_count DESC;

GRANT SELECT ON ontology.v_resolution_backlog       TO authenticated, service_role;
GRANT SELECT ON ontology.v_pending_rfc_domains      TO authenticated, service_role;
GRANT SELECT ON ontology.v_transversal_topics       TO authenticated, service_role;
GRANT SELECT ON ontology.v_semantic_noise           TO authenticated, service_role;
GRANT SELECT ON ontology.v_cross_domain_candidates  TO authenticated, service_role;
