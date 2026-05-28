-- ============================================================
-- ENAZIZI — ONTOLOGY ROLLOUT GOVERNANCE (Freeze v25)
-- ============================================================

-- 1) CONSUMER CERTIFICATIONS ------------------------------------
CREATE TABLE ontology.consumer_certifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_name       text NOT NULL,
  maturity_level      text NOT NULL
                      CHECK (maturity_level IN ('L0','L1','L2','L3','L4','L5')),
  certified_by        text NOT NULL,
  certification_date  timestamptz NOT NULL DEFAULT now(),
  ontology_version    text NOT NULL,
  rollback_tested     boolean NOT NULL DEFAULT false,
  production_approved boolean NOT NULL DEFAULT false,
  notes               text,
  UNIQUE (consumer_name, maturity_level, ontology_version)
);

CREATE INDEX idx_cc_consumer ON ontology.consumer_certifications (consumer_name);

GRANT SELECT                       ON ontology.consumer_certifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ontology.consumer_certifications TO service_role;

ALTER TABLE ontology.consumer_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on certifications"
  ON ontology.consumer_certifications
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read certifications"
  ON ontology.consumer_certifications
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE ontology.consumer_certifications IS
'Governance: each consumer maturity level requires an explicit certification with rollback test and production approval.';

-- 2) PER-CONSUMER FEATURE FLAGS ---------------------------------
CREATE TABLE ontology.consumer_feature_flags (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_name       text NOT NULL,
  feature_name        text NOT NULL,
  enabled             boolean NOT NULL DEFAULT false,
  rollout_percentage  int NOT NULL DEFAULT 0
                      CHECK (rollout_percentage BETWEEN 0 AND 100),
  ontology_version    text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consumer_name, feature_name)
);

GRANT SELECT                       ON ontology.consumer_feature_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ontology.consumer_feature_flags TO service_role;

ALTER TABLE ontology.consumer_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on feature flags"
  ON ontology.consumer_feature_flags
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read feature flags"
  ON ontology.consumer_feature_flags
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE ontology.consumer_feature_flags IS
'Governance: per-consumer rollout. Every ontology read in production MUST be gated by a flag row here.';

-- 3) SYSTEM-LEVEL KILL SWITCH -----------------------------------
CREATE TABLE ontology.system_flags (
  flag_name   text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  notes       text
);

GRANT SELECT                       ON ontology.system_flags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ontology.system_flags TO service_role;

ALTER TABLE ontology.system_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on system flags"
  ON ontology.system_flags
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated read system flags"
  ON ontology.system_flags
  FOR SELECT TO authenticated
  USING (true);

INSERT INTO ontology.system_flags (flag_name, enabled, updated_by, notes) VALUES
  ('ontology_runtime_enabled', false, 'system',
   'Master kill switch. When false, all consumers MUST fall back to legacy runtime.');

COMMENT ON TABLE ontology.system_flags IS
'Governance: system-wide kill switches. ontology_runtime_enabled is the master switch — consumers must respect it and fall back to legacy when false.';

-- 4) SLO DASHBOARD VIEW -----------------------------------------
CREATE OR REPLACE VIEW ontology.v_ontology_slo
WITH (security_invoker = true) AS
SELECT
  (SELECT COUNT(*) FROM ontology.v_semantic_drift)                                        AS drift_count,
  (SELECT COUNT(*) FROM ontology.question_semantic_links qsl
     LEFT JOIN ontology.curriculum_nodes cn ON cn.id = qsl.node_id
     WHERE cn.id IS NULL)                                                                  AS orphan_links,
  (SELECT COUNT(*) FROM ontology.curriculum_nodes WHERE deprecated_at IS NOT NULL)         AS deprecated_nodes,
  (SELECT COUNT(*) FROM ontology.v_unregistered_consumers)                                 AS consumer_mismatch_count,
  (SELECT COUNT(*) FROM ontology.consumer_feature_flags WHERE enabled = true)              AS active_feature_flags,
  (SELECT COUNT(DISTINCT consumer_name) FROM ontology.consumer_certifications
     WHERE production_approved = true)                                                     AS certified_consumers,
  (SELECT COUNT(DISTINCT consumer_name) FROM ontology.consumer_certifications
     WHERE production_approved = true AND rollback_tested = true)                          AS rollback_ready_consumers,
  (SELECT enabled FROM ontology.system_flags
     WHERE flag_name = 'ontology_runtime_enabled')                                         AS ontology_runtime_enabled,
  (SELECT slug FROM ontology.v_active_ontology_version LIMIT 1)                            AS active_version_slug,
  now() AS observed_at;

GRANT SELECT ON ontology.v_ontology_slo TO authenticated, service_role;

COMMENT ON VIEW ontology.v_ontology_slo IS
'Observability: SLO snapshot — drift, orphans, deprecation, consumer mismatch, certification coverage, rollback readiness, kill-switch state.';

-- DOWN:
-- DROP VIEW IF EXISTS ontology.v_ontology_slo;
-- DROP TABLE IF EXISTS ontology.system_flags;
-- DROP TABLE IF EXISTS ontology.consumer_feature_flags;
-- DROP TABLE IF EXISTS ontology.consumer_certifications;