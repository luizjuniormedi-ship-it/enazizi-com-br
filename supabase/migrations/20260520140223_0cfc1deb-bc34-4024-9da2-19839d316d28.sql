CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Since the table was created in the previous turn, we alter it to add new columns if they don't exist
-- or recreate it if it was just a skeleton (the user provided a full CREATE TABLE again).
-- To be safe, let's use a robust approach: check columns and add if missing.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rag_knowledge_base' AND column_name='version') THEN
        ALTER TABLE public.rag_knowledge_base ADD COLUMN version integer DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rag_knowledge_base' AND column_name='token_count') THEN
        ALTER TABLE public.rag_knowledge_base ADD COLUMN token_count integer DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rag_knowledge_base' AND column_name='last_accessed_at') THEN
        ALTER TABLE public.rag_knowledge_base ADD COLUMN last_accessed_at timestamptz DEFAULT now();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rag_knowledge_base' AND column_name='access_count') THEN
        ALTER TABLE public.rag_knowledge_base ADD COLUMN access_count integer DEFAULT 0;
    END IF;
END $$;

-- Update Policies
DROP POLICY IF EXISTS "Authenticated users can read knowledge base" ON public.rag_knowledge_base;
DROP POLICY IF EXISTS "Anon can insert knowledge" ON public.rag_knowledge_base;
DROP POLICY IF EXISTS "All can read" ON public.rag_knowledge_base;
DROP POLICY IF EXISTS "All can insert" ON public.rag_knowledge_base;
DROP POLICY IF EXISTS "All can update" ON public.rag_knowledge_base;

CREATE POLICY "All can read" ON public.rag_knowledge_base FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "All can insert" ON public.rag_knowledge_base FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "All can update" ON public.rag_knowledge_base FOR UPDATE TO authenticated, anon USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rag_kb_topic_trgm ON public.rag_knowledge_base USING gin(topic gin_trgm_ops);
