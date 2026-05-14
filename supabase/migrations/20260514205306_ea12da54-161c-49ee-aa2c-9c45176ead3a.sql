-- Add new columns to questions_bank for Enterprise 2026 scoring
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS clinical_density_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS board_similarity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS guideline_recency_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS distractor_quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cognitive_complexity_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tri_difficulty_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS official_exam_flag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS guideline_reference TEXT,
ADD COLUMN IF NOT EXISTS guideline_year INTEGER;

-- Create clinical_guidelines table
CREATE TABLE IF NOT EXISTS public.clinical_guidelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity TEXT NOT NULL,
    guideline_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    valid_until DATE,
    summary TEXT,
    keywords TEXT[],
    specialty TEXT,
    version TEXT,
    evidence_level TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow public read of guidelines') THEN
        ALTER TABLE public.clinical_guidelines ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow public read of guidelines" ON public.clinical_guidelines FOR SELECT USING (true);
    END IF;
END $$;

-- Create telemetry_events for cognitive tracking
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    context_type TEXT,
    context_id UUID,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own telemetry') THEN
        ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can insert their own telemetry" ON public.telemetry_events FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own telemetry') THEN
        CREATE POLICY "Users can view their own telemetry" ON public.telemetry_events FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create ingestion_pipeline_runs for monitoring
CREATE TABLE IF NOT EXISTS public.ingestion_pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.official_exam_sources(id),
    run_type TEXT,
    status TEXT DEFAULT 'pending',
    stats JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can view ingestion runs') THEN
        ALTER TABLE public.ingestion_pipeline_runs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Admins can view ingestion runs" ON public.ingestion_pipeline_runs FOR SELECT USING (true);
    END IF;
END $$;
