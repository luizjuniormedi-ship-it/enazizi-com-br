-- Habilitar vector se não estiver habilitado
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabela de Dataset Ouro (Questões Reais de Prova)
CREATE TABLE IF NOT EXISTS public.golden_exam_dataset (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banca TEXT NOT NULL,
    especialidade TEXT,
    dificuldade INTEGER DEFAULT 3,
    year INTEGER,
    statement TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT,
    
    -- Metadados de Qualidade
    stmt_length INTEGER,
    option_avg_length INTEGER,
    bloom_level TEXT,
    tech_density_score INTEGER DEFAULT 0,
    clinical_density_score INTEGER DEFAULT 0,
    cognitive_complexity_score INTEGER DEFAULT 0,
    
    -- Busca Semântica
    embedding vector(1536),
    semantic_features JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index HNSW para busca por similaridade de cosseno
CREATE INDEX IF NOT EXISTS golden_exam_embedding_idx ON public.golden_exam_dataset 
USING hnsw (embedding vector_cosine_ops);

-- Tabela de Logs de Qualidade Forense
CREATE TABLE IF NOT EXISTS public.forensic_quality_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID,
    board TEXT NOT NULL,
    fidelity_score INTEGER NOT NULL,
    
    structural_score INTEGER,
    lexical_score INTEGER,
    cognitive_score INTEGER,
    pedagogical_score INTEGER,
    
    ai_pattern_score INTEGER,
    flags TEXT[],
    
    decision TEXT NOT NULL,
    raw_response_preview TEXT,
    
    professor_rating INTEGER,
    professor_feedback TEXT,
    professor_id UUID REFERENCES auth.users(id),
    
    correlation_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.golden_exam_dataset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_quality_logs ENABLE ROW LEVEL SECURITY;

-- Políticas Golden Dataset
CREATE POLICY "Admins can manage golden dataset" ON public.golden_exam_dataset
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view golden dataset" ON public.golden_exam_dataset
    FOR SELECT TO authenticated USING (true);

-- Políticas Forensic Logs
CREATE POLICY "Admins can view forensic logs" ON public.forensic_quality_logs
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Professors can rate forensic logs" ON public.forensic_quality_logs
    FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'professor') OR public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
-- Note: update_updated_at_column should exist, but let's check or create it if missing
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_golden_exam_dataset_updated_at') THEN
        CREATE TRIGGER update_golden_exam_dataset_updated_at
        BEFORE UPDATE ON public.golden_exam_dataset
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
