
-- ============================================================================
-- ENAZIZI — Hardening Final da Ontologia (Freeze v25)
-- Zero impacto no runtime legado
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 0: schema ontology + USAGE grants
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS ontology;

GRANT USAGE ON SCHEMA ontology TO authenticated;
GRANT USAGE ON SCHEMA ontology TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA ontology
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA ontology
  GRANT ALL ON TABLES TO service_role;

-- ----------------------------------------------------------------------------
-- STEP 1: Move existing ontology tables + function from public to ontology
--         RLS, policies, indexes, constraints, triggers, grants all preserved.
-- ----------------------------------------------------------------------------
ALTER TABLE public.ontology_versions         SET SCHEMA ontology;
ALTER TABLE public.curriculum_nodes          SET SCHEMA ontology;
ALTER TABLE public.curriculum_edges          SET SCHEMA ontology;
ALTER TABLE public.question_semantic_links   SET SCHEMA ontology;
ALTER TABLE public.pending_semantic_review   SET SCHEMA ontology;

ALTER FUNCTION public.curriculum_nodes_block_identity_mutation() SET SCHEMA ontology;

-- Fix the trigger function's search_path now that it lives in ontology
ALTER FUNCTION ontology.curriculum_nodes_block_identity_mutation()
  SET search_path = ontology, public;

-- ----------------------------------------------------------------------------
-- STEP 2: Metadata validation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ontology.validate_metadata_shape(meta jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ontology, public
AS $$
DECLARE
  tags jsonb;
BEGIN
  -- NULL is rejected — column default is '{}'
  IF meta IS NULL THEN
    RETURN false;
  END IF;

  -- Must be a JSON object
  IF jsonb_typeof(meta) <> 'object' THEN
    RETURN false;
  END IF;

  -- Size guard: 8 KB max
  IF octet_length(meta::text) > 8192 THEN
    RETURN false;
  END IF;

  -- semantic_tags (when present) must be an array
  IF meta ? 'semantic_tags' THEN
    tags := meta -> 'semantic_tags';
    IF jsonb_typeof(tags) <> 'array' THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

ALTER TABLE ontology.curriculum_nodes
  ADD CONSTRAINT curriculum_nodes_metadata_shape
    CHECK (ontology.validate_metadata_shape(metadata));

ALTER TABLE ontology.curriculum_edges
  ADD CONSTRAINT curriculum_edges_metadata_shape
    CHECK (ontology.validate_metadata_shape(metadata));

ALTER TABLE ontology.question_semantic_links
  ADD CONSTRAINT question_semantic_links_metadata_shape
    CHECK (ontology.validate_metadata_shape(metadata));

-- ----------------------------------------------------------------------------
-- STEP 3: semantic_status on curriculum_nodes
-- ----------------------------------------------------------------------------
ALTER TABLE ontology.curriculum_nodes
  ADD COLUMN semantic_status text NOT NULL DEFAULT 'approved'
    CHECK (semantic_status IN ('draft','approved','frozen','deprecated','experimental'));

CREATE INDEX curriculum_nodes_semantic_status_idx
  ON ontology.curriculum_nodes (semantic_status);

-- ----------------------------------------------------------------------------
-- STEP 4: Lineage validation + columns
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ontology.validate_lineage_shape(lin jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ontology, public
AS $$
BEGIN
  -- NULL allowed in this phase
  IF lin IS NULL THEN
    RETURN true;
  END IF;

  -- Must be a JSON object
  IF jsonb_typeof(lin) <> 'object' THEN
    RETURN false;
  END IF;

  -- Size guard: 4 KB max
  IF octet_length(lin::text) > 4096 THEN
    RETURN false;
  END IF;

  -- Typed fields (when present) must be text
  IF lin ? 'pipeline'         AND jsonb_typeof(lin -> 'pipeline')         NOT IN ('string','null') THEN RETURN false; END IF;
  IF lin ? 'reviewer'         AND jsonb_typeof(lin -> 'reviewer')         NOT IN ('string','null') THEN RETURN false; END IF;
  IF lin ? 'rfc'              AND jsonb_typeof(lin -> 'rfc')              NOT IN ('string','null') THEN RETURN false; END IF;
  IF lin ? 'ontology_version' AND jsonb_typeof(lin -> 'ontology_version') NOT IN ('string','null') THEN RETURN false; END IF;
  IF lin ? 'model'            AND jsonb_typeof(lin -> 'model')            NOT IN ('string','null') THEN RETURN false; END IF;

  RETURN true;
END;
$$;

ALTER TABLE ontology.question_semantic_links
  ADD COLUMN lineage jsonb,
  ADD CONSTRAINT question_semantic_links_lineage_shape
    CHECK (ontology.validate_lineage_shape(lineage));

ALTER TABLE ontology.pending_semantic_review
  ADD COLUMN lineage jsonb,
  ADD CONSTRAINT pending_semantic_review_lineage_shape
    CHECK (ontology.validate_lineage_shape(lineage));

-- ----------------------------------------------------------------------------
-- STEP 5: Edge governance matrix + trigger
-- ----------------------------------------------------------------------------
CREATE TABLE ontology.allowed_edge_matrix (
  parent_type text NOT NULL,
  child_type  text NOT NULL,
  edge_type   text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_type, child_type, edge_type),
  CONSTRAINT aem_parent_type_check
    CHECK (parent_type IN ('specialty','domain','system','disease','subtopic','knowledge_dimension','cross_domain')),
  CONSTRAINT aem_child_type_check
    CHECK (child_type  IN ('specialty','domain','system','disease','subtopic','knowledge_dimension','cross_domain')),
  CONSTRAINT aem_no_self_type CHECK (parent_type <> child_type)
);

GRANT SELECT ON ontology.allowed_edge_matrix TO authenticated;
GRANT ALL    ON ontology.allowed_edge_matrix TO service_role;

ALTER TABLE ontology.allowed_edge_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allowed_edge_matrix readable by authenticated"
  ON ontology.allowed_edge_matrix FOR SELECT TO authenticated USING (true);

-- Seed canonical relationships
INSERT INTO ontology.allowed_edge_matrix (parent_type, child_type, edge_type) VALUES
  ('specialty',           'domain',              'contains'),
  ('specialty',           'system',              'covers'),
  ('specialty',           'cross_domain',        'intersects'),
  ('specialty',           'knowledge_dimension', 'requires'),
  ('domain',              'disease',             'contains'),
  ('domain',              'subtopic',            'contains'),
  ('domain',              'cross_domain',        'intersects'),
  ('system',              'disease',             'manifests'),
  ('system',              'subtopic',            'contains'),
  ('disease',             'subtopic',            'contains'),
  ('cross_domain',        'knowledge_dimension', 'requires'),
  ('knowledge_dimension', 'subtopic',            'covers');

-- Trigger: validate every edge against the matrix + reject cycles
CREATE OR REPLACE FUNCTION ontology.validate_curriculum_edge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ontology, public
AS $$
DECLARE
  parent_t text;
  child_t  text;
  is_allowed boolean;
  creates_cycle boolean;
BEGIN
  -- Fetch node types
  SELECT node_type INTO parent_t FROM ontology.curriculum_nodes WHERE id = NEW.parent_node_id;
  SELECT node_type INTO child_t  FROM ontology.curriculum_nodes WHERE id = NEW.child_node_id;

  IF parent_t IS NULL OR child_t IS NULL THEN
    RAISE EXCEPTION 'curriculum_edges: parent or child node not found';
  END IF;

  -- Validate against allowed matrix
  SELECT EXISTS (
    SELECT 1 FROM ontology.allowed_edge_matrix m
    WHERE m.parent_type = parent_t
      AND m.child_type  = child_t
      AND m.edge_type   = NEW.edge_type
      AND m.active = true
  ) INTO is_allowed;

  IF NOT is_allowed THEN
    RAISE EXCEPTION
      'curriculum_edges: relation (%->%, edge_type=%) not present in allowed_edge_matrix',
      parent_t, child_t, NEW.edge_type;
  END IF;

  -- Cycle detection: walk down from child, abort if we reach parent
  WITH RECURSIVE descendants(node_id, depth) AS (
    SELECT NEW.child_node_id, 0
    UNION ALL
    SELECT e.child_node_id, d.depth + 1
    FROM ontology.curriculum_edges e
    JOIN descendants d ON e.parent_node_id = d.node_id
    WHERE d.depth < 32
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE node_id = NEW.parent_node_id)
  INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION
      'curriculum_edges: edge would create a cycle (parent=% child=%)',
      NEW.parent_node_id, NEW.child_node_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER curriculum_edges_governance
  BEFORE INSERT OR UPDATE ON ontology.curriculum_edges
  FOR EACH ROW EXECUTE FUNCTION ontology.validate_curriculum_edge();

-- ============================================================================
-- DOWN MIGRATION (documented)
-- ============================================================================
-- DROP TRIGGER IF EXISTS curriculum_edges_governance ON ontology.curriculum_edges;
-- DROP FUNCTION IF EXISTS ontology.validate_curriculum_edge();
-- DROP TABLE IF EXISTS ontology.allowed_edge_matrix;
-- ALTER TABLE ontology.pending_semantic_review   DROP CONSTRAINT IF EXISTS pending_semantic_review_lineage_shape;
-- ALTER TABLE ontology.pending_semantic_review   DROP COLUMN IF EXISTS lineage;
-- ALTER TABLE ontology.question_semantic_links   DROP CONSTRAINT IF EXISTS question_semantic_links_lineage_shape;
-- ALTER TABLE ontology.question_semantic_links   DROP COLUMN IF EXISTS lineage;
-- DROP FUNCTION IF EXISTS ontology.validate_lineage_shape(jsonb);
-- DROP INDEX  IF EXISTS ontology.curriculum_nodes_semantic_status_idx;
-- ALTER TABLE ontology.curriculum_nodes          DROP COLUMN IF EXISTS semantic_status;
-- ALTER TABLE ontology.question_semantic_links   DROP CONSTRAINT IF EXISTS question_semantic_links_metadata_shape;
-- ALTER TABLE ontology.curriculum_edges          DROP CONSTRAINT IF EXISTS curriculum_edges_metadata_shape;
-- ALTER TABLE ontology.curriculum_nodes          DROP CONSTRAINT IF EXISTS curriculum_nodes_metadata_shape;
-- DROP FUNCTION IF EXISTS ontology.validate_metadata_shape(jsonb);
-- ALTER FUNCTION ontology.curriculum_nodes_block_identity_mutation() SET SCHEMA public;
-- ALTER TABLE ontology.pending_semantic_review   SET SCHEMA public;
-- ALTER TABLE ontology.question_semantic_links   SET SCHEMA public;
-- ALTER TABLE ontology.curriculum_edges          SET SCHEMA public;
-- ALTER TABLE ontology.curriculum_nodes          SET SCHEMA public;
-- ALTER TABLE ontology.ontology_versions         SET SCHEMA public;
-- DROP SCHEMA IF EXISTS ontology;
