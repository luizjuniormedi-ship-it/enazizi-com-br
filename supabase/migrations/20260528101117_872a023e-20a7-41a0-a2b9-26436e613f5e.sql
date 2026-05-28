
CREATE OR REPLACE FUNCTION public.ontology_observatory_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ontology, public
AS $$
DECLARE
  v_kill_switch boolean;
  v_health      jsonb;
  v_drift       jsonb;
BEGIN
  -- Kill switch
  BEGIN
    SELECT (value::text)::boolean INTO v_kill_switch
    FROM ontology.system_flags
    WHERE flag_key = 'ontology_runtime_enabled'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_kill_switch := false;
  END;

  -- Health (may not exist)
  BEGIN
    SELECT to_jsonb(h.*) INTO v_health FROM ontology.v_ontology_health h LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_health := null;
  END;

  -- Drift (may not exist)
  BEGIN
    SELECT jsonb_agg(to_jsonb(d.*)) INTO v_drift FROM ontology.v_semantic_drift d LIMIT 200;
  EXCEPTION WHEN OTHERS THEN
    v_drift := null;
  END;

  RETURN jsonb_build_object(
    'observed_at', now(),
    'kill_switch_enabled', COALESCE(v_kill_switch, false),
    'ontology_health', v_health,
    'semantic_drift', v_drift,
    'resolution_backlog', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb)
      FROM ontology.v_resolution_backlog r
    ),
    'pending_rfc_domains', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb)
      FROM ontology.v_pending_rfc_domains r
    ),
    'semantic_noise', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb)
      FROM ontology.v_semantic_noise r
    ),
    'transversal_topics', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb)
      FROM ontology.v_transversal_topics r
    ),
    'cross_domain_candidates', (
      SELECT COALESCE(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb)
      FROM ontology.v_cross_domain_candidates r
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ontology_observatory_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ontology_observatory_snapshot() TO authenticated, service_role;
