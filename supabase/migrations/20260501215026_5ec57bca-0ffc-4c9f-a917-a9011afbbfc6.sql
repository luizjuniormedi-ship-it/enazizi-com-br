-- Create table for consolidated session content
CREATE TABLE IF NOT EXISTS public.cme_session_aggregations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tutor_session_id UUID NOT NULL REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
    aggregated_content TEXT NOT NULL,
    detected_topics TEXT[],
    total_blocks INTEGER DEFAULT 0,
    estimated_duration_seconds INTEGER DEFAULT 0,
    narrative_density FLOAT DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for pedagogical lesson blocks/chapters
CREATE TABLE IF NOT EXISTS public.cme_lesson_blocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    aggregation_id UUID NOT NULL REFERENCES public.cme_session_aggregations(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL, -- introduction, pathophysiology, clinical, diagnosis, treatment, feynman, case_study, quiz, review, summary
    title TEXT NOT NULL,
    block_order INTEGER NOT NULL,
    cognitive_density FLOAT DEFAULT 0,
    estimated_minutes FLOAT DEFAULT 0,
    source_message_ids UUID[], -- Array of message IDs that contributed to this block
    content TEXT NOT NULL,
    scene_graph_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add aggregation link to video projects
ALTER TABLE public.cme_video_projects 
ADD COLUMN IF NOT EXISTS aggregation_id UUID REFERENCES public.cme_session_aggregations(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.cme_session_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_lesson_blocks ENABLE ROW LEVEL SECURITY;

-- Policies for aggregations
CREATE POLICY "Users can view their own session aggregations"
ON public.cme_session_aggregations
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.tutor_sessions
    WHERE tutor_sessions.id = cme_session_aggregations.tutor_session_id
    AND tutor_sessions.user_id = auth.uid()
));

-- Policies for blocks
CREATE POLICY "Users can view blocks of their session aggregations"
ON public.cme_lesson_blocks
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.cme_session_aggregations sa
    JOIN public.tutor_sessions ts ON ts.id = sa.tutor_session_id
    WHERE sa.id = cme_lesson_blocks.aggregation_id
    AND ts.user_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_cme_session_aggregations_updated_at
BEFORE UPDATE ON public.cme_session_aggregations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cme_lesson_blocks_updated_at
BEFORE UPDATE ON public.cme_lesson_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
