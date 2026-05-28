-- ============================================================
-- Wave: Semantic Review Center — RPC governada (Freeze v25)
-- Único caminho de escrita do painel /admin/semantic-review-center.
-- Append-only, auditável, fail-closed.
-- ============================================================

-- ───── 1. Tabela de auditoria (garantida idempotente) ─────────
CREATE TABLE IF NOT EXISTS ontology.semantic_change_audit (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor                uuid NOT NULL,
  action               text NOT NULL,
  target               text NOT NULL,
  rfc_id               text,
  justification        text NOT NULL,
  ontology_version     uuid,
  rollout_stage        text,
  rollback_available   boolean NOT NULL DEFAULT true,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON ontology.semantic_change_audit TO authenticated;
GRANT ALL    ON ontology.semantic_change_audit TO service_role;

ALTER TABLE ontology.semantic_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit readable by admins" ON ontology.semantic_change_audit;
CREATE POLICY "audit readable by admins"
  ON ontology.semantic_change_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Append-only: nenhum UPDATE/DELETE; INSERT exclusivamente via RPC SECURITY DEFINER.

-- ───── 2. Helper: papel de governança semântica ───────────────
CREATE OR REPLACE FUNCTION ontology.is_semantic_governor(_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, ontology
AS $$
DECLARE
  _is_admin boolean := false;
  _has_board boolean := false;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  -- admin é obrigatório (sempre existe no enum)
  SELECT public.has_role(_uid, 'admin') INTO _is_admin;
  IF _is_admin THEN RETURN true; END IF;

  -- semantic_board / platform_admin são tolerados caso o enum
  -- já tenha sido estendido. Se não existirem, ignoramos sem falhar.
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _uid
        AND role::text IN ('semantic_board', 'platform_admin')
    ) INTO _has_board;
  EXCEPTION WHEN others THEN
    _has_board := false;
  END;

  RETURN COALESCE(_has_board, false);
END;
$$;

REVOKE ALL ON FUNCTION ontology.is_semantic_governor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ontology.is_semantic_governor(uuid) TO authenticated, service_role;

-- ───── 3. RPC principal: ontology_review_action ──────────────
CREATE OR REPLACE FUNCTION public.ontology_review_action(
  p_kind   text,
  p_target text,
  p_meta   jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ontology
AS $$
DECLARE
  _uid                uuid := auth.uid();
  _justification      text := COALESCE(NULLIF(trim(p_meta->>'justification'), ''), '');
  _rfc_id             text := NULLIF(trim(COALESCE(p_meta->>'rfc_id', '')), '');
  _ontology_version   uuid;
  _proposed_node      uuid;
  _runtime_enabled    boolean := false;
  _kill_switch        boolean := false;
  _audit_id           uuid;
  _review_row         ontology.pending_semantic_review%ROWTYPE;
BEGIN
  -- ── 3.1 Auth ──────────────────────────────────────────────
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT ontology.is_semantic_governor(_uid) THEN
    RAISE EXCEPTION 'forbidden: caller is not a semantic governor' USING ERRCODE = '42501';
  END IF;

  -- ── 3.2 Allow-list de ações ───────────────────────────────
  IF p_kind NOT IN (
    'approve_semantic_link',
    'reject_semantic_review',
    'mark_semantic_noise',
    'escalate_to_rfc'
  ) THEN
    RAISE EXCEPTION 'invalid action: %', p_kind USING ERRCODE = '22023';
  END IF;

  -- ── 3.3 Justificativa obrigatória (mínimo 10 chars) ───────
  IF length(_justification) < 10 THEN
    RAISE EXCEPTION 'justification required (min 10 chars)' USING ERRCODE = '22023';
  END IF;

  -- ── 3.4 RFC obrigatório para escalate ─────────────────────
  IF p_kind = 'escalate_to_rfc' AND _rfc_id IS NULL THEN
    RAISE EXCEPTION 'rfc_id required for escalate_to_rfc' USING ERRCODE = '22023';
  END IF;

  -- ── 3.5 Fail-closed: runtime/kill_switch devem estar OFF ──
  BEGIN
    SELECT COALESCE((value->>'enabled')::boolean, false) INTO _runtime_enabled
      FROM public.system_settings WHERE key = 'ontology_runtime_enabled';
  EXCEPTION WHEN others THEN _runtime_enabled := false; END;

  BEGIN
    SELECT COALESCE((value->>'enabled')::boolean, false) INTO _kill_switch
      FROM public.system_settings WHERE key = 'ontology_kill_switch';
  EXCEPTION WHEN others THEN _kill_switch := false; END;

  IF _runtime_enabled THEN
    RAISE EXCEPTION 'ontology runtime is enabled — review actions are blocked while runtime is live' USING ERRCODE = '55006';
  END IF;

  IF _kill_switch THEN
    RAISE EXCEPTION 'ontology kill switch is active — all review actions are halted' USING ERRCODE = '55006';
  END IF;

  -- ── 3.6 Ação específica ───────────────────────────────────
  IF p_kind = 'approve_semantic_link' THEN
    -- exige versão de ontologia ativa
    BEGIN
      SELECT id INTO _ontology_version
        FROM ontology.ontology_versions
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT 1;
    EXCEPTION WHEN others THEN _ontology_version := NULL; END;

    IF _ontology_version IS NULL THEN
      RAISE EXCEPTION 'no active ontology_version found' USING ERRCODE = '23514';
    END IF;

    -- carrega a linha de revisão (p_target = pending_semantic_review.id)
    BEGIN
      SELECT * INTO _review_row
        FROM ontology.pending_semantic_review
        WHERE id = p_target::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'pending_semantic_review not found: %', p_target USING ERRCODE = '02000';
    END;

    IF _review_row.id IS NULL THEN
      RAISE EXCEPTION 'pending_semantic_review not found: %', p_target USING ERRCODE = '02000';
    END IF;

    IF _review_row.review_status IS NOT NULL
       AND _review_row.review_status NOT IN ('pending', 'in_review') THEN
      RAISE EXCEPTION 'review already finalized (status=%)', _review_row.review_status USING ERRCODE = '40001';
    END IF;

    -- INSERT append-only em question_semantic_links
    INSERT INTO ontology.question_semantic_links (
      question_id,
      node_id,
      relation_type,
      confidence,
      source,
      ontology_version,
      lineage,
      created_by,
      created_at
    ) VALUES (
      _review_row.question_id,
      _review_row.proposed_node,
      COALESCE(p_meta->>'relation_type', 'primary'),
      _review_row.confidence,
      'human_review',
      _ontology_version,
      jsonb_build_object(
        'source', 'semantic_review_center',
        'review_id', _review_row.id,
        'reviewer', _uid,
        'justification', _justification
      ),
      _uid,
      now()
    );

    -- marca review como aprovada
    UPDATE ontology.pending_semantic_review
       SET review_status = 'approved',
           reviewed_by   = _uid,
           reviewed_at   = now()
     WHERE id = _review_row.id;

  ELSIF p_kind = 'reject_semantic_review' THEN
    UPDATE ontology.pending_semantic_review
       SET review_status = 'rejected',
           reviewed_by   = _uid,
           reviewed_at   = now()
     WHERE id = p_target::uuid;

  ELSIF p_kind = 'mark_semantic_noise' THEN
    UPDATE ontology.pending_semantic_review
       SET review_status = 'noise',
           reviewed_by   = _uid,
           reviewed_at   = now()
     WHERE id = p_target::uuid;

  ELSIF p_kind = 'escalate_to_rfc' THEN
    -- não muda specialty_id, não cria specialty — apenas registra escalação
    UPDATE ontology.pending_semantic_review
       SET review_status = 'rfc_escalated',
           reviewed_by   = _uid,
           reviewed_at   = now()
     WHERE id = p_target::uuid;
  END IF;

  -- ── 3.7 Auditoria append-only ─────────────────────────────
  INSERT INTO ontology.semantic_change_audit (
    actor, action, target, rfc_id, justification,
    ontology_version, rollout_stage, rollback_available, metadata
  ) VALUES (
    _uid, p_kind, p_target, _rfc_id, _justification,
    _ontology_version, 'observational', true,
    p_meta - 'justification' - 'rfc_id'
  )
  RETURNING id INTO _audit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'audit_id', _audit_id,
    'action', p_kind,
    'target', p_target,
    'ontology_version', _ontology_version
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ontology_review_action(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ontology_review_action(text, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.ontology_review_action(text, text, jsonb) IS
  'Único caminho de escrita do Semantic Review Center. Append-only, auditado, fail-closed. Nunca toca questions_bank.specialty_id, FSRS, Planner, Tutor, TRI ou simulados. Freeze v25.';