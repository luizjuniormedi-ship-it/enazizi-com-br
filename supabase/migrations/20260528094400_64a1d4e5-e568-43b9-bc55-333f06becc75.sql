
-- ============================================================================
-- ENAZIZI — Ontologia Curricular Multi-Eixo (Fase 1)
-- Freeze v25 Safe Migration — Zero Breaking Changes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ontology_versions
-- ----------------------------------------------------------------------------
CREATE TABLE public.ontology_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ontology_versions TO authenticated;
GRANT ALL    ON public.ontology_versions TO service_role;

ALTER TABLE public.ontology_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ontology_versions readable by authenticated"
  ON public.ontology_versions FOR SELECT TO authenticated USING (true);

-- Single-active invariant
CREATE UNIQUE INDEX ontology_versions_only_one_active
  ON public.ontology_versions ((1)) WHERE active = true;

-- ----------------------------------------------------------------------------
-- 2. curriculum_nodes (append-only ontology graph)
-- ----------------------------------------------------------------------------
CREATE TABLE public.curriculum_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  normalized_name text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  deprecated_at timestamptz,
  replaced_by uuid REFERENCES public.curriculum_nodes(id) ON DELETE SET NULL,
  ontology_version_id uuid NOT NULL REFERENCES public.ontology_versions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_nodes_node_type_check
    CHECK (node_type IN ('specialty','domain','system','disease','subtopic','knowledge_dimension','cross_domain'))
);

CREATE INDEX curriculum_nodes_type_idx        ON public.curriculum_nodes (node_type);
CREATE INDEX curriculum_nodes_normalized_idx  ON public.curriculum_nodes (normalized_name);
CREATE INDEX curriculum_nodes_active_idx      ON public.curriculum_nodes (active) WHERE active = true;
CREATE INDEX curriculum_nodes_version_idx     ON public.curriculum_nodes (ontology_version_id);

GRANT SELECT ON public.curriculum_nodes TO authenticated;
GRANT ALL    ON public.curriculum_nodes TO service_role;

ALTER TABLE public.curriculum_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculum_nodes readable by authenticated"
  ON public.curriculum_nodes FOR SELECT TO authenticated USING (true);

-- Immutability guard: block UPDATEs on name / slug / node_type / normalized_name
CREATE OR REPLACE FUNCTION public.curriculum_nodes_block_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name <> OLD.name
     OR NEW.slug <> OLD.slug
     OR NEW.node_type <> OLD.node_type
     OR NEW.normalized_name <> OLD.normalized_name THEN
    RAISE EXCEPTION 'curriculum_nodes is append-only: use deprecated_at + replaced_by instead of mutating identity fields';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER curriculum_nodes_identity_lock
  BEFORE UPDATE ON public.curriculum_nodes
  FOR EACH ROW EXECUTE FUNCTION public.curriculum_nodes_block_identity_mutation();

-- ----------------------------------------------------------------------------
-- 3. curriculum_edges (graph relationships)
-- ----------------------------------------------------------------------------
CREATE TABLE public.curriculum_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_node_id uuid NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
  child_node_id  uuid NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL,
  ontology_version_id uuid NOT NULL REFERENCES public.ontology_versions(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_edges_no_self_loop CHECK (parent_node_id <> child_node_id),
  CONSTRAINT curriculum_edges_unique UNIQUE (parent_node_id, child_node_id, edge_type, ontology_version_id)
);

CREATE INDEX curriculum_edges_parent_idx  ON public.curriculum_edges (parent_node_id);
CREATE INDEX curriculum_edges_child_idx   ON public.curriculum_edges (child_node_id);
CREATE INDEX curriculum_edges_version_idx ON public.curriculum_edges (ontology_version_id);

GRANT SELECT ON public.curriculum_edges TO authenticated;
GRANT ALL    ON public.curriculum_edges TO service_role;

ALTER TABLE public.curriculum_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "curriculum_edges readable by authenticated"
  ON public.curriculum_edges FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 4. question_semantic_links (single flexible link table)
-- ----------------------------------------------------------------------------
CREATE TABLE public.question_semantic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE RESTRICT,
  confidence numeric(4,3),
  source text NOT NULL,
  review_status text NOT NULL DEFAULT 'approved',
  ontology_version_id uuid NOT NULL REFERENCES public.ontology_versions(id) ON DELETE RESTRICT,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qsl_source_check
    CHECK (source IN ('manual','rfc','semantic_pipeline','curator_import')),
  CONSTRAINT qsl_review_status_check
    CHECK (review_status IN ('approved','rolled_back')),
  CONSTRAINT qsl_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT qsl_unique UNIQUE (question_id, node_id, ontology_version_id)
);

CREATE INDEX qsl_question_idx ON public.question_semantic_links (question_id);
CREATE INDEX qsl_node_idx     ON public.question_semantic_links (node_id);
CREATE INDEX qsl_version_idx  ON public.question_semantic_links (ontology_version_id);

GRANT SELECT ON public.question_semantic_links TO authenticated;
GRANT ALL    ON public.question_semantic_links TO service_role;

ALTER TABLE public.question_semantic_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_semantic_links readable by authenticated"
  ON public.question_semantic_links FOR SELECT TO authenticated USING (true);

-- ----------------------------------------------------------------------------
-- 5. pending_semantic_review (mandatory human queue)
-- ----------------------------------------------------------------------------
CREATE TABLE public.pending_semantic_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
  suggested_node_id uuid NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
  confidence numeric(4,3),
  source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rollback_snapshot jsonb,
  ontology_version_id uuid NOT NULL REFERENCES public.ontology_versions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT psr_source_check
    CHECK (source IN ('manual','rfc','semantic_pipeline','curator_import')),
  CONSTRAINT psr_review_status_check
    CHECK (review_status IN ('pending','approved','rejected','rolled_back')),
  CONSTRAINT psr_confidence_range
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX psr_question_idx        ON public.pending_semantic_review (question_id);
CREATE INDEX psr_node_idx            ON public.pending_semantic_review (suggested_node_id);
CREATE INDEX psr_status_pending_idx  ON public.pending_semantic_review (review_status) WHERE review_status = 'pending';
CREATE INDEX psr_version_idx         ON public.pending_semantic_review (ontology_version_id);

GRANT SELECT ON public.pending_semantic_review TO authenticated;
GRANT ALL    ON public.pending_semantic_review TO service_role;

ALTER TABLE public.pending_semantic_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pending_semantic_review readable by authenticated"
  ON public.pending_semantic_review FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- DOWN MIGRATION (documented for rollback)
-- ============================================================================
-- DROP TABLE IF EXISTS public.pending_semantic_review;
-- DROP TABLE IF EXISTS public.question_semantic_links;
-- DROP TABLE IF EXISTS public.curriculum_edges;
-- DROP TRIGGER IF EXISTS curriculum_nodes_identity_lock ON public.curriculum_nodes;
-- DROP FUNCTION IF EXISTS public.curriculum_nodes_block_identity_mutation();
-- DROP TABLE IF EXISTS public.curriculum_nodes;
-- DROP TABLE IF EXISTS public.ontology_versions;
