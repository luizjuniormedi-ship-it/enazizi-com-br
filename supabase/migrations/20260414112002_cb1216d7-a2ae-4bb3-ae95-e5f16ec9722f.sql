
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Service can manage decisions" ON public.assistant_decisions;

-- Edge functions use service_role key which bypasses RLS, so no explicit policy needed for them.
-- The existing user policies are sufficient for client-side access.
