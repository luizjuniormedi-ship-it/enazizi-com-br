CREATE TABLE public.rag_knowledge_base (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  topic text NOT NULL,
  specialty text NOT NULL,
  content text NOT NULL,
  source text DEFAULT 'tutor-3.0-generated',
  tags text[] DEFAULT '{}',
  board text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.rag_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read knowledge base"
  ON public.rag_knowledge_base FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can insert/update"
  ON public.rag_knowledge_base FOR ALL
  TO service_role USING (true);

CREATE POLICY "Anon can insert knowledge"
  ON public.rag_knowledge_base FOR INSERT
  TO anon WITH CHECK (true);

CREATE INDEX idx_rag_kb_topic ON public.rag_knowledge_base(topic);
CREATE INDEX idx_rag_kb_specialty ON public.rag_knowledge_base(specialty);