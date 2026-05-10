-- Create the vector search function for RAG
CREATE OR REPLACE FUNCTION public.match_rag_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  document_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.content,
    rc.document_id,
    1 - (re.embedding <=> query_embedding) AS similarity
  FROM rag_chunks rc
  JOIN rag_embeddings re ON rc.id = re.chunk_id
  WHERE 1 - (re.embedding <=> query_embedding) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Ensure RLS allows the edge function (service role) to read these tables
-- Normally service role bypasses RLS, but let's make sure policies exist if needed
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on rag_chunks" ON public.rag_chunks
  USING (true) WITH CHECK (true);
CREATE POLICY "Service role can do everything on rag_embeddings" ON public.rag_embeddings
  USING (true) WITH CHECK (true);
