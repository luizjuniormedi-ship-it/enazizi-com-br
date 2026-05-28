-- ============================================================
-- ENAZIZI — ONTOLOGY OBSERVABILITY LAYER (Freeze v25)
-- ============================================================

-- 1) ACCESS LOG -------------------------------------------------
CREATE TABLE ontology.ontology_access_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_name   text NOT NULL,
  consumer_version text,
  ontology_version text,
  accessed_view   text NOT NULL,
  feature_flag    text,
  user_id         uuid,
  accessed_at     timestamptz NOT NULL DEFAULT now(),
  request_id      text,
  environment     text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_oal_consumer        ON ontology.ontology_access_log (consumer_name, accessed_at DESC);
CREATE INDEX idx_oal_view            ON ontology.ontology_access_log (accessed_view, accessed_at DESC);
CREATE INDEX idx_oal_accessed_at     ON ontology.ontology_access_log (accessed_at DESC);

GRANT SELECT, INSERT ON ontology.ontology_access_log TO service_role;
GRANT SELECT         ON ontology.ontology_access_log TO authenticated;

ALTER TABLE ontology.ontology_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on access log"
  ON ontology.ontology_access_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read access log"
  ON ontology.ontology_access_log
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE ontology.ontology_access_log IS
'Observability: append log of every ontology view read. Opt-in only — consumers must log themselves explicitly.';

-- 2) REGISTERED CONSUMERS ---------------------------------------
CREATE TABLE ontology.registered_consumers (
  consumer_name           text PRIMARY KEY,
  owner                   text NOT NULL,
  allowed_views           text[] NOT NULL DEFAULT '{}',
  ontology_version_pinned text NOT NULL,
  rollout_stage           text NOT NULL DEFAULT 'disabled'
                          CHECK (rollout_stage IN ('disabled','internal','beta','canary','ga')),
  active                  boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT                       ON ontology.registered_consumers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ontology.registered_consumers TO service_role;

ALTER TABLE ontology.registered_consumers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on registered consumers"
  ON ontology.registered_consumers
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read registered consumers"
  ON ontology.registered_consumers
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE ontology.registered_consumers IS
'Governance: every consumer reading ontology.* MUST be registered here, with pinned ontology_version and rollout stage.';

-- 3) UNREGISTERED CONSUMERS VIEW --------------------------------
CREATE OR REPLACE VIEW ontology.v_unregistered_consumers
WITH (security_invoker = true) AS
SELECT
  oal.consumer_name,
  oal.accessed_view,
  oal.ontology_version,
  COUNT(*)                       AS access_count,
  MAX(oal.accessed_at)           AS last_access_at,
  CASE
    WHEN rc.consumer_name IS NULL                                       THEN 'not_registered'
    WHEN rc.active = false                                              THEN 'consumer_inactive'
    WHEN NOT (oal.accessed_view = ANY(rc.allowed_views))                THEN 'view_not_allowed'
    WHEN oal.ontology_version IS DISTINCT FROM rc.ontology_version_pinned THEN 'version_not_pinned'
    ELSE 'ok'
  END AS violation_type
FROM ontology.ontology_access_log oal
LEFT JOIN ontology.registered_consumers rc
  ON rc.consumer_name = oal.consumer_name
GROUP BY oal.consumer_name, oal.accessed_view, oal.ontology_version,
         rc.consumer_name, rc.active, rc.allowed_views, rc.ontology_version_pinned
HAVING
     rc.consumer_name IS NULL
  OR rc.active = false
  OR NOT (oal.accessed_view = ANY(rc.allowed_views))
  OR oal.ontology_version IS DISTINCT FROM rc.ontology_version_pinned;

GRANT SELECT ON ontology.v_unregistered_consumers TO authenticated, service_role;

COMMENT ON VIEW ontology.v_unregistered_consumers IS
'Observability: detects unregistered consumers, disallowed views, inactive registrations and unpinned versions. Read-only.';

-- 4) SEMANTIC CHANGE AUDIT (append-only) ------------------------
CREATE TABLE ontology.semantic_change_audit (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfc_id              text NOT NULL,
  actor               text NOT NULL,
  approved_by         text,
  ontology_version    text NOT NULL,
  change_type         text NOT NULL,
  target_table        text,
  target_id           text,
  before_state        jsonb,
  after_state         jsonb,
  rollback_reference  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sca_rfc       ON ontology.semantic_change_audit (rfc_id);
CREATE INDEX idx_sca_created   ON ontology.semantic_change_audit (created_at DESC);

GRANT SELECT, INSERT ON ontology.semantic_change_audit TO service_role;
GRANT SELECT         ON ontology.semantic_change_audit TO authenticated;

ALTER TABLE ontology.semantic_change_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role append audit"
  ON ontology.semantic_change_audit
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role read audit"
  ON ontology.semantic_change_audit
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "authenticated read audit"
  ON ontology.semantic_change_audit
  FOR SELECT TO authenticated
  USING (true);

-- Append-only enforcement
CREATE OR REPLACE FUNCTION ontology.block_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ontology, public
AS $$
BEGIN
  RAISE EXCEPTION 'ontology.semantic_change_audit is append-only (RFC-governed)';
END;
$$;

CREATE TRIGGER trg_block_audit_update
  BEFORE UPDATE ON ontology.semantic_change_audit
  FOR EACH ROW EXECUTE FUNCTION ontology.block_audit_mutation();

CREATE TRIGGER trg_block_audit_delete
  BEFORE DELETE ON ontology.semantic_change_audit
  FOR EACH ROW EXECUTE FUNCTION ontology.block_audit_mutation();

COMMENT ON TABLE ontology.semantic_change_audit IS
'Governance: append-only audit of every curricular change. UPDATE/DELETE blocked by trigger. Every entry requires an RFC.';

-- 5) HEALTH DASHBOARD VIEW --------------------------------------
CREATE OR REPLACE VIEW ontology.v_ontology_health
WITH (security_invoker = true) AS
SELECT
  (SELECT COUNT(*) FROM ontology.registered_consumers)                                          AS total_consumers,
  (SELECT COUNT(*) FROM ontology.registered_consumers WHERE active = true)                      AS active_consumers,
  (SELECT COUNT(DISTINCT ontology_version_pinned) FROM ontology.registered_consumers WHERE active = true) AS distinct_pinned_versions,
  (SELECT COUNT(*) FROM ontology.v_unregistered_consumers)                                      AS unregistered_access_groups,
  (SELECT COUNT(*) FROM ontology.v_semantic_drift)                                              AS drift_count,
  (SELECT COUNT(*) FROM ontology.curriculum_nodes WHERE deprecated_at IS NOT NULL)              AS deprecated_nodes,
  (SELECT COUNT(*) FROM ontology.question_semantic_links qsl
     LEFT JOIN ontology.curriculum_nodes cn ON cn.id = qsl.node_id
     WHERE cn.id IS NULL)                                                                       AS orphan_semantic_links,
  (SELECT COUNT(*) FROM ontology.pending_semantic_review WHERE review_status = 'pending')       AS pending_rfc_reviews,
  (SELECT slug FROM ontology.v_active_ontology_version LIMIT 1)                                 AS active_version_slug,
  now() AS observed_at;

GRANT SELECT ON ontology.v_ontology_health TO authenticated, service_role;

COMMENT ON VIEW ontology.v_ontology_health IS
'Observability: single-row health dashboard combining consumer adoption, drift, deprecation and RFC backlog.';

-- DOWN (rollback):
-- DROP VIEW IF EXISTS ontology.v_ontology_health;
-- DROP TRIGGER IF EXISTS trg_block_audit_delete ON ontology.semantic_change_audit;
-- DROP TRIGGER IF EXISTS trg_block_audit_update ON ontology.semantic_change_audit;
-- DROP FUNCTION IF EXISTS ontology.block_audit_mutation();
-- DROP TABLE IF EXISTS ontology.semantic_change_audit;
-- DROP VIEW IF EXISTS ontology.v_unregistered_consumers;
-- DROP TABLE IF EXISTS ontology.registered_consumers;
-- DROP TABLE IF EXISTS ontology.ontology_access_log;