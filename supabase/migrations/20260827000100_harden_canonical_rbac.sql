-- Canonical RBAC hardening.
-- Authorization comes exclusively from public.user_roles. Profile fields are
-- descriptive and must never grant privileges.

-- Remove the known legacy profile policy whose predicate trusted profiles.role.
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;

-- Fail closed for any other deployed policy that still explicitly references
-- profiles.role. We deliberately do not attempt a textual rewrite of policy
-- expressions because that could broaden unrelated predicates.
DO $migration$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (
        COALESCE(qual, '') ~* 'profiles[.]role'
        OR COALESCE(with_check, '') ~* 'profiles[.]role'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END
$migration$;

-- Keep profile self-service for ordinary fields, but reject attempts to mutate
-- identity, approval or authorization-adjacent fields. Service-role calls have
-- no auth.uid() and admin-actions remains the audited privilege boundary.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.has_role('admin')
     AND (
       NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
     )
  THEN
    RAISE EXCEPTION 'profile_privileged_fields_are_server_managed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER protect_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- The onboarding UI updates only the authenticated user's descriptive fields.
-- Without an UPDATE policy PostgREST returns success with zero affected rows,
-- leaving the user trapped in the onboarding gate.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- A legacy trigger still deployed on practice_attempts calls
-- refresh_domain_mastery(), which references the removed columns
-- practice_attempts.topic and medical_domain_map.mastery_level. Every insert
-- currently aborts with PostgreSQL 42703. Domain/proficiency recalculation is
-- already handled by the canonical study-complete/impact engines, so remove
-- the obsolete synchronous trigger instead of blocking answer persistence.
DROP TRIGGER IF EXISTS tr_refresh_mastery_on_practice ON public.practice_attempts;
DROP FUNCTION IF EXISTS public.refresh_domain_mastery();

-- Role writes must go through admin-actions (JWT validation, admin check and
-- audit log) or a service-role process. Reading one's own roles remains intact.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

DROP POLICY IF EXISTS "Service role can insert roles" ON public.user_roles;
CREATE POLICY "Service role can manage roles"
ON public.user_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
