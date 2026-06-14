DROP POLICY IF EXISTS "Admins can manage batches" ON public.classification_batches;

CREATE POLICY "Admins can manage batches"
ON public.classification_batches
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));