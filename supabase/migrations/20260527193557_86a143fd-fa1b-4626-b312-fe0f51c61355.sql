
-- 1) Fix SECURITY DEFINER functions missing search_path
ALTER FUNCTION public.check_duplicate_tutor_sessions() SET search_path = public;
ALTER FUNCTION public.get_avg_tutor_latency(integer) SET search_path = public;
ALTER FUNCTION public.get_login_stats() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.notify_pedagogical_event() SET search_path = public, extensions;

-- 2) Tighten RAG tenant isolation policies from {public} to {authenticated}
DROP POLICY IF EXISTS "Tenant isolation for chunks" ON public.rag_chunks;
CREATE POLICY "Tenant isolation for chunks"
ON public.rag_chunks
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT profiles.organization_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Tenant isolation for embeddings" ON public.rag_embeddings;
CREATE POLICY "Tenant isolation for embeddings"
ON public.rag_embeddings
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT profiles.organization_id
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
  )
);
