-- 1. Create missing tables
CREATE TABLE IF NOT EXISTS public.official_exam_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.official_exam_files(id),
    download_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, downloading, completed, failed
    file_size BIGINT,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_gabaritos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_file_id UUID REFERENCES public.official_exam_files(id),
    file_url TEXT,
    storage_path TEXT,
    content JSONB, -- Extracted answers
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.official_exam_questions(id),
    asset_type TEXT, -- image, table, chart
    storage_path TEXT,
    ocr_content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_question_id UUID REFERENCES public.official_exam_questions(id),
    duplicate_question_id UUID REFERENCES public.official_exam_questions(id),
    similarity_score NUMERIC,
    detection_method TEXT, -- semantic, textual, hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_ingestion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.official_exam_sources(id),
    action TEXT, -- scan, download, extract, classify
    status TEXT, -- success, failure
    details JSONB,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    value NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context TEXT, -- function name, table name
    error_message TEXT,
    payload JSONB,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.official_exam_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT, -- file, question, asset
    item_id UUID,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'queued', -- queued, processing, completed, failed
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enhance existing tables
ALTER TABLE public.official_exam_files 
ADD COLUMN IF NOT EXISTS institution TEXT,
ADD COLUMN IF NOT EXISTS specialty TEXT,
ADD COLUMN IF NOT EXISTS year INTEGER,
ADD COLUMN IF NOT EXISTS banca TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS exam_type TEXT; -- residencia, revalida, etc.

ALTER TABLE public.official_exam_questions
ADD COLUMN IF NOT EXISTS comment TEXT,
ADD COLUMN IF NOT EXISTS specialty TEXT,
ADD COLUMN IF NOT EXISTS sub_topic TEXT,
ADD COLUMN IF NOT EXISTS difficulty TEXT,
ADD COLUMN IF NOT EXISTS level TEXT,
ADD COLUMN IF NOT EXISTS incidence NUMERIC,
ADD COLUMN IF NOT EXISTS embedding VECTOR(1536); -- For similarity detection (requires pgvector)

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- 3. Enable RLS
ALTER TABLE public.official_exam_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_gabaritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_exam_processing_queue ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Admin only for most, read-only for users if needed)
-- For now, allow authenticated users for simplicity in testing, but restricted in production
CREATE POLICY "Authenticated users can view exam harvester data" ON public.official_exam_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view exam harvester files" ON public.official_exam_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view exam harvester questions" ON public.official_exam_questions FOR SELECT TO authenticated USING (true);

-- 5. Storage Buckets
-- These are usually created via API or manual, but we can try to insert into storage.buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('official-exams', 'official-exams', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('official-gabaritos', 'official-gabaritos', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('official-assets', 'official-assets', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('official-images', 'official-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('official-discursivas', 'official-discursivas', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('official-practical-exams', 'official-practical-exams', false) ON CONFLICT (id) DO NOTHING;

-- Policies for storage
CREATE POLICY "Allow public read for images and assets" ON storage.objects FOR SELECT USING (bucket_id IN ('official-images', 'official-assets'));
CREATE POLICY "Authenticated users can upload to harvester buckets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id LIKE 'official-%');
