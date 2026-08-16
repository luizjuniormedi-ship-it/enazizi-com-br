-- P0: harden the canonical question bank without rewriting existing content.
-- Goals:
--   1. global questions are never readable by anonymous clients;
--   2. authenticated users cannot self-publish or self-approve questions;
--   3. backend generators consume one explicit eligibility contract.

DROP POLICY IF EXISTS "Users can view global questions" ON public.questions_bank;
DROP POLICY IF EXISTS "Users can CRUD own questions" ON public.questions_bank;

CREATE POLICY "Authenticated users can view eligible global questions"
ON public.questions_bank
FOR SELECT
TO authenticated
USING (
  is_global IS TRUE
  AND review_status = 'approved'
  AND approved_for_generation IS TRUE
  AND lower(COALESCE(lifecycle_state, 'generated')) NOT IN (
    'archived', 'out_of_scope', 'purged', 'quarantined', 'suspended'
  )
  AND lower(COALESCE(quality_tier, '')) NOT IN ('needs_upgrade', 'rejected')
  AND strpos(COALESCE(statement, ''), chr(65533)) = 0
  AND strpos(COALESCE(explanation, ''), chr(65533)) = 0
  AND strpos(COALESCE(options::text, ''), chr(65533)) = 0
);

CREATE POLICY "Users can view own questions"
ON public.questions_bank
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create private pending questions"
ON public.questions_bank
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND is_global IS NOT TRUE
  AND review_status = 'pending'
);

CREATE POLICY "Users can update own private pending questions"
ON public.questions_bank
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND is_global IS NOT TRUE
  AND review_status = 'pending'
);

CREATE POLICY "Users can delete own questions"
ON public.questions_bank
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE VIEW public.eligible_questions_bank
WITH (security_invoker = true)
AS
SELECT
  id,
  statement,
  options,
  correct_index,
  explanation,
  topic,
  subtopic,
  curriculum_theme,
  curriculum_subtheme,
  difficulty,
  board
FROM public.questions_bank
WHERE is_global IS TRUE
  AND review_status = 'approved'
  AND approved_for_generation IS TRUE
  AND lower(COALESCE(lifecycle_state, 'generated')) NOT IN (
    'archived', 'out_of_scope', 'purged', 'quarantined', 'suspended'
  )
  AND lower(COALESCE(quality_tier, '')) NOT IN ('needs_upgrade', 'rejected')
  AND strpos(COALESCE(statement, ''), chr(65533)) = 0
  AND strpos(COALESCE(explanation, ''), chr(65533)) = 0
  AND strpos(COALESCE(options::text, ''), chr(65533)) = 0;

COMMENT ON VIEW public.eligible_questions_bank IS
  'Canonical read contract for approved question generation. Never use questions_bank directly in generators.';

REVOKE ALL ON public.eligible_questions_bank FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.eligible_questions_bank TO service_role;
