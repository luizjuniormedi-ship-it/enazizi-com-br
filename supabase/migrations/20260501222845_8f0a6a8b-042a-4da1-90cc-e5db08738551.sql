-- Enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cme_aggregation_status') THEN
        CREATE TYPE public.cme_aggregation_status AS ENUM ('pending', 'aggregating', 'blocks_generated', 'builder_ready', 'rendering', 'validating', 'ready', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cme_block_type') THEN
        CREATE TYPE public.cme_block_type AS ENUM ('introduction', 'physiology', 'clinic', 'diagnosis', 'treatment', 'pharmacology', 'case_study', 'feynman', 'review', 'summary');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cme_render_status') THEN
        CREATE TYPE public.cme_render_status AS ENUM ('queued', 'planning', 'scene_graph_generation', 'rendering', 'uploading', 'validating', 'ready', 'failed');
    END IF;
END $$;

-- Drop view CASCADE to allow structure changes
DROP VIEW IF EXISTS public.cme_session_aggregation_summary CASCADE;

-- Enhance cme_session_aggregations
ALTER TABLE public.cme_session_aggregations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS aggregation_status public.cme_aggregation_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS pipeline_last_error TEXT,
ADD COLUMN IF NOT EXISTS detected_specialties JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER,
ADD COLUMN IF NOT EXISTS cognitive_density NUMERIC;

-- Enhance cme_render_jobs
ALTER TABLE public.cme_render_jobs 
ADD COLUMN IF NOT EXISTS aggregation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS render_lineage JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pipeline_last_error TEXT,
ADD COLUMN IF NOT EXISTS vram_usage NUMERIC;

-- Enhance cme_pipeline_events
ALTER TABLE public.cme_pipeline_events 
ADD COLUMN IF NOT EXISTS render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS aggregation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create Lesson Blocks
CREATE TABLE IF NOT EXISTS public.cme_lesson_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregation_id UUID NOT NULL REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    block_type public.cme_block_type NOT NULL,
    title TEXT,
    content TEXT,
    order_index INTEGER NOT NULL,
    estimated_minutes INTEGER,
    cognitive_density NUMERIC,
    replay_risk NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Quality Reviews
CREATE TABLE IF NOT EXISTS public.cme_quality_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregation_id UUID NOT NULL REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    quality_score NUMERIC,
    fatigue_score NUMERIC,
    continuity_score NUMERIC,
    drift_score NUMERIC,
    review_notes TEXT,
    approved BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_session_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_lesson_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_quality_reviews ENABLE ROW LEVEL SECURITY;

-- Enterprise RLS Policies
DO $$ 
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Admins full access" ON public.cme_session_aggregations';
    EXECUTE 'DROP POLICY IF EXISTS "Users view self aggregations" ON public.cme_session_aggregations';
    EXECUTE 'DROP POLICY IF EXISTS "Users view self blocks" ON public.cme_lesson_blocks';
    EXECUTE 'DROP POLICY IF EXISTS "Users view self renders" ON public.cme_render_jobs';
    EXECUTE 'DROP POLICY IF EXISTS "Users view self events" ON public.cme_pipeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "Coordinators manage reviews" ON public.cme_quality_reviews';
END $$;

CREATE POLICY "Admins full access" ON public.cme_session_aggregations FOR ALL TO authenticated USING (auth.jwt()->>'role' = 'admin');
CREATE POLICY "Users view self aggregations" ON public.cme_session_aggregations FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users view self blocks" ON public.cme_lesson_blocks FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.cme_session_aggregations a WHERE a.id = aggregation_id AND a.user_id = auth.uid()));

CREATE POLICY "Users view self renders" ON public.cme_render_jobs FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.cme_session_aggregations a WHERE a.id = aggregation_id AND a.user_id = auth.uid()));

CREATE POLICY "Users view self events" ON public.cme_pipeline_events FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.cme_session_aggregations a WHERE a.id = aggregation_id AND a.user_id = auth.uid()));

CREATE POLICY "Coordinators manage reviews" ON public.cme_quality_reviews FOR ALL TO authenticated USING (auth.jwt()->>'role' = 'coordinator');

-- Recreate View
CREATE VIEW public.cme_session_aggregation_summary AS
SELECT 
    a.id,
    a.title,
    a.aggregation_status,
    a.created_at,
    (SELECT count(*) FROM public.cme_lesson_blocks b WHERE b.aggregation_id = a.id) as blocks_count,
    r.status as render_status,
    r.progress as render_progress
FROM public.cme_session_aggregations a
LEFT JOIN public.cme_render_jobs r ON a.id = r.aggregation_id;