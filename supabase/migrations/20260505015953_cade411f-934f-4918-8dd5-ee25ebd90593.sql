-- Add publication control to uploads
ALTER TABLE public.uploads 
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure non-admins only see published uploads
-- (Students usually only see is_global=true anyway, but we add is_published filter)
CREATE POLICY "Students can only see published uploads"
ON public.uploads
FOR SELECT
USING (
    (is_published = true AND is_active = true) OR
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'professor')
    )
);
