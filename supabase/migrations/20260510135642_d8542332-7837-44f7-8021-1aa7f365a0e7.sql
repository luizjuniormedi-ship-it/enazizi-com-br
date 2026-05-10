CREATE OR REPLACE FUNCTION public.get_rag_health_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_docs', (SELECT count(*) FROM rag_documents),
    'total_chunks', (SELECT count(*) FROM rag_chunks),
    'total_embeddings', (SELECT count(*) FROM rag_embeddings)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_function_exists(func_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' 
    AND p.proname = func_name
  );
END;
$$;