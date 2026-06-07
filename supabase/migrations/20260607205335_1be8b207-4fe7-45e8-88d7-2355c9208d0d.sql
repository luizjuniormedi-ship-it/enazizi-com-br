-- Enable pgvector for semantic search and deduplication
CREATE EXTENSION IF NOT EXISTS vector;

-- Phase 2: Curriculum Registry
CREATE TABLE IF NOT EXISTS public.curriculum_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_area TEXT NOT NULL,
    curriculum_theme TEXT NOT NULL,
    curriculum_subtheme TEXT NOT NULL,
    curriculum_competency TEXT NOT NULL,
    competency_id TEXT UNIQUE NOT NULL,
    specialty TEXT NOT NULL,
    cognitive_level TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 3: Competency Aliases
CREATE TABLE IF NOT EXISTS public.competency_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competency_id TEXT REFERENCES public.curriculum_registry(competency_id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(competency_id, alias)
);

-- Phase 4 & 5: Classification Staging
CREATE TABLE IF NOT EXISTS public.question_classification_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions_bank(id) ON DELETE CASCADE,
    predicted_theme TEXT,
    predicted_subtheme TEXT,
    predicted_competency TEXT,
    competency_id TEXT,
    confidence_score FLOAT,
    classification_source TEXT DEFAULT 'ai_classification_v1',
    classification_status TEXT CHECK (classification_status IN ('auto_approved', 'sampled_review', 'manual_review', 'pending')),
    embedding vector(1536), -- For deduplication and semantic analysis
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 7: Deduplication Clusters
CREATE TABLE IF NOT EXISTS public.question_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_representative_id UUID REFERENCES public.questions_bank(id),
    similarity_threshold FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Extend questions_bank table for Phase 9
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS curriculum_theme TEXT,
ADD COLUMN IF NOT EXISTS curriculum_subtheme TEXT,
ADD COLUMN IF NOT EXISTS curriculum_competency TEXT,
ADD COLUMN IF NOT EXISTS competency_id TEXT,
ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'active';

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competency_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_classification_staging TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_clusters TO authenticated;
GRANT ALL ON public.curriculum_registry TO service_role;
GRANT ALL ON public.competency_aliases TO service_role;
GRANT ALL ON public.question_classification_staging TO service_role;
GRANT ALL ON public.question_clusters TO service_role;

-- RLS
ALTER TABLE public.curriculum_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_classification_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for authenticated" ON public.curriculum_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON public.competency_aliases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON public.question_classification_staging FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON public.question_clusters FOR SELECT TO authenticated USING (true);
