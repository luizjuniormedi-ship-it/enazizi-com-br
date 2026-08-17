DROP POLICY IF EXISTS "Admins can view editorial question queue" ON public.questions_bank;
CREATE POLICY "Admins can view editorial question queue"
ON public.questions_bank
FOR SELECT
TO authenticated
USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_questions_bank_editorial_queue
ON public.questions_bank (lifecycle_state, review_status, created_at DESC)
WHERE lower(COALESCE(lifecycle_state, '')) = 'quarantined'
   OR review_status = 'needs_review';
