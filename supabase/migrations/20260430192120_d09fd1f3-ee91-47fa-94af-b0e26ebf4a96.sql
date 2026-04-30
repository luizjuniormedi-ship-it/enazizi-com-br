-- Create medical_prompt_execution_logs table
CREATE TABLE IF NOT EXISTS public.medical_prompt_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE SET NULL,
    prompt_id UUID REFERENCES public.medical_ai_prompts(id) ON DELETE SET NULL,
    prompt_version TEXT,
    specialty TEXT,
    model TEXT,
    input_tokens INT,
    output_tokens INT,
    latency_ms INT,
    estimated_cost NUMERIC,
    json_validation_status TEXT,
    hallucination_risk TEXT,
    cache_status TEXT, -- cache_hit_hash, cache_hit_topic, cache_miss, reused_existing_content
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add multimedia tracking to master_content_library (using IF NOT EXISTS logic as it might have been partially applied)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_content_library' AND column_name = 'media_status') THEN
        ALTER TABLE public.master_content_library ADD COLUMN media_status TEXT DEFAULT 'none';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_content_library' AND column_name = 'media_added_by') THEN
        ALTER TABLE public.master_content_library ADD COLUMN media_added_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_content_library' AND column_name = 'media_added_at') THEN
        ALTER TABLE public.master_content_library ADD COLUMN media_added_at TIMESTAMPTZ;
    END IF;
END $$;

-- Extend pedagogical_reviews
ALTER TABLE public.pedagogical_reviews
ADD COLUMN IF NOT EXISTS notebooklm_script_quality_score INTEGER,
ADD COLUMN IF NOT EXISTS reliability_score INTEGER;

-- Enable RLS
ALTER TABLE public.medical_prompt_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins can view all logs" ON public.medical_prompt_execution_logs;
CREATE POLICY "Admins can view all logs" 
ON public.medical_prompt_execution_logs 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.user_type IN ('admin', 'super_admin')
));

-- Index for semantic cache search (using discipline as that is the actual column name)
CREATE INDEX IF NOT EXISTS idx_content_semantic_cache 
ON public.master_content_library (discipline, topic, subtopic, status);
