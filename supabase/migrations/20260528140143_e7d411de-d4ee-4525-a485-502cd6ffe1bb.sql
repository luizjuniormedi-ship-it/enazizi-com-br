DROP POLICY IF EXISTS "Users can read relevant uploads" ON public.uploads;

CREATE POLICY "Users can read relevant uploads"
ON public.uploads
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    organization_id IS NOT NULL
    AND organization_id IN (
      SELECT profiles.organization_id
      FROM public.profiles
      WHERE profiles.user_id = auth.uid()
    )
  )
  OR (
    is_global = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY['admin'::app_role, 'professor'::app_role])
    )
  )
);