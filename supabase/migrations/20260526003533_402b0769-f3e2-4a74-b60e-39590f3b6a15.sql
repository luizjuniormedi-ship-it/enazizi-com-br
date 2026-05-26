-- ============================================================
-- SECURITY FIX: Storage policies using manipulable JWT role v25
-- Replace auth.jwt()->>'role' = 'service_role' with
-- auth.role() = 'service_role' for storage bucket access.
-- ============================================================

DROP POLICY IF EXISTS "Admins can upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read materials" ON storage.objects;

CREATE POLICY "Admins can upload materials"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai_production_materials'
  AND (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = ANY(ARRAY['admin', 'professor'])
    )
  )
);

CREATE POLICY "Admins can read materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai_production_materials'
  AND (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.user_type = ANY(ARRAY['admin', 'professor'])
    )
  )
);