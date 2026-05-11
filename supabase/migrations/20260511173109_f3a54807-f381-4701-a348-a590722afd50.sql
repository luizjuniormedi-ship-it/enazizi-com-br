-- Table for individual PDF chunks
CREATE TABLE IF NOT EXISTS public.planner_pdf_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    page_start INTEGER,
    page_end INTEGER,
    raw_text TEXT NOT NULL,
    extracted_topics_json JSONB,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, error
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for consolidated topics
CREATE TABLE IF NOT EXISTS public.planner_extracted_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topics_json JSONB NOT NULL,
    coverage_stats JSONB, -- { total_chunks, completed_chunks, total_pages }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planner_pdf_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_extracted_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own pdf chunks" 
ON public.planner_pdf_chunks 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own extracted topics" 
ON public.planner_extracted_topics 
FOR ALL 
USING (auth.uid() = user_id);

-- Update timestamp triggers
CREATE TRIGGER update_planner_pdf_chunks_updated_at
BEFORE UPDATE ON public.planner_pdf_chunks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planner_extracted_topics_updated_at
BEFORE UPDATE ON public.planner_extracted_topics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();