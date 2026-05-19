-- Update study_plans
ALTER TABLE public.study_plans 
ADD COLUMN IF NOT EXISTS total_available_minutes INTEGER,
ADD COLUMN IF NOT EXISTS total_required_minutes INTEGER,
ADD COLUMN IF NOT EXISTS feasibility_status TEXT;

-- Update study_plan_items
ALTER TABLE public.study_plan_items
ADD COLUMN IF NOT EXISTS source_page INTEGER,
ADD COLUMN IF NOT EXISTS source_chunk_id UUID,
ADD COLUMN IF NOT EXISTS raw_excerpt TEXT;

-- Enhance planner_pdf_chunks
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_pdf_chunks' AND column_name = 'study_plan_id') THEN
        ALTER TABLE public.planner_pdf_chunks ADD COLUMN study_plan_id UUID REFERENCES public.study_plans(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_pdf_chunks' AND column_name = 'token_count') THEN
        ALTER TABLE public.planner_pdf_chunks ADD COLUMN token_count INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_pdf_chunks' AND column_name = 'processing_status') THEN
        ALTER TABLE public.planner_pdf_chunks ADD COLUMN processing_status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Enhance planner_extracted_topics (re-create for correct structure)
DROP TABLE IF EXISTS public.planner_extracted_topics;
CREATE TABLE public.planner_extracted_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    study_plan_id UUID REFERENCES public.study_plans(id) ON DELETE CASCADE,
    discipline TEXT,
    topic TEXT,
    subtopic TEXT,
    source_page INTEGER,
    source_chunk_id UUID REFERENCES public.planner_pdf_chunks(id) ON DELETE SET NULL,
    raw_excerpt TEXT,
    confidence_score NUMERIC,
    validation_status TEXT DEFAULT 'extracted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planner_extracted_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own extracted topics"
    ON public.planner_extracted_topics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own extracted topics"
    ON public.planner_extracted_topics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own extracted topics"
    ON public.planner_extracted_topics FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own extracted topics"
    ON public.planner_extracted_topics FOR DELETE
    USING (auth.uid() = user_id);
