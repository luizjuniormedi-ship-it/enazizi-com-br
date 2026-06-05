-- 1. Question Explanations Cache
CREATE TABLE IF NOT EXISTS public.question_explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.real_exam_questions(id) ON DELETE CASCADE,
    explanation TEXT NOT NULL,
    clinical_reasoning TEXT,
    key_points JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_explanations_qid ON public.question_explanations(question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_explanations TO authenticated;
GRANT ALL ON public.question_explanations TO service_role;

ALTER TABLE public.question_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view question explanations" ON public.question_explanations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins/service can manage explanations" ON public.question_explanations FOR ALL TO service_role USING (true);

-- 2. Flashcard Generation Cache
CREATE TABLE IF NOT EXISTS public.flashcard_generation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash TEXT NOT NULL UNIQUE,
    cards JSONB NOT NULL,
    topic TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_generation_cache TO authenticated;
GRANT ALL ON public.flashcard_generation_cache TO service_role;

ALTER TABLE public.flashcard_generation_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view flashcard cache" ON public.flashcard_generation_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins/service can manage flashcard cache" ON public.flashcard_generation_cache FOR ALL TO service_role USING (true);

-- 3. Optimization for tutor_knowledge_memory (Pedagogical Cache)
-- Ensure embedding index exists if not already
-- CREATE INDEX IF NOT EXISTS tutor_knowledge_memory_embedding_idx ON public.tutor_knowledge_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4. Trigger for updated_at on question_explanations
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_question_explanations_updated_at
BEFORE UPDATE ON public.question_explanations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
