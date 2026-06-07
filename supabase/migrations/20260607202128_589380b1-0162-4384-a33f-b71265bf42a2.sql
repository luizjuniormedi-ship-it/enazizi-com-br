
-- 1. Uploads: drop the over-permissive policy and replace it.
DROP POLICY IF EXISTS "Students can only see published uploads" ON public.uploads;

-- The existing "Users can read relevant uploads" policy already covers:
--   own rows, same-organization rows, and global rows for admin/professor.
-- We add a narrow policy so non-admin/professor users can still read globally
-- published&active materials (which is what the original policy intended),
-- without exposing every user's row.
CREATE POLICY "Anyone authenticated can read published global uploads"
ON public.uploads
FOR SELECT
TO authenticated
USING (
  is_global = true
  AND is_published = true
  AND is_active = true
);

-- 2. Questions bank: remove blanket read access.
DROP POLICY IF EXISTS "All authenticated can read all questions" ON public.questions_bank;
-- The remaining policies "Users can view global questions" (is_global = true)
-- and "Users can CRUD own questions" (user_id = auth.uid()) provide the correct
-- scoped access. Private user questions are no longer readable by other users.

-- 3. Audit view: enforce caller's RLS, not the view owner's.
ALTER VIEW public.audit_domain_consistency SET (security_invoker = on);
