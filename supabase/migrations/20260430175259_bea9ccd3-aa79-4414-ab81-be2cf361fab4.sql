-- Enhance ai_usage_logs for better tracking
ALTER TABLE public.ai_usage_logs 
ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS prompt_type TEXT,
ADD COLUMN IF NOT EXISTS json_validation_status TEXT CHECK (json_validation_status IN ('valid', 'repaired', 'invalid', 'failed')),
ADD COLUMN IF NOT EXISTS error_code TEXT;

-- Enhance master_content_library for multimedia assets
ALTER TABLE public.master_content_library 
ADD COLUMN IF NOT EXISTS media_status TEXT DEFAULT 'none' CHECK (media_status IN ('none', 'exported_to_notebooklm', 'audio_linked', 'video_linked', 'ready_for_students')),
ADD COLUMN IF NOT EXISTS media_added_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS media_added_at TIMESTAMP WITH TIME ZONE;

-- Create export logs for NotebookLM tracking
CREATE TABLE IF NOT EXISTS public.ai_export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id),
    user_id UUID REFERENCES auth.users(id),
    destination TEXT DEFAULT 'notebooklm',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for export logs
ALTER TABLE public.ai_export_logs ENABLE ROW LEVEL SECURITY;

-- Policy for export logs
CREATE POLICY "Admins and professors can view export logs"
ON public.ai_export_logs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'professor')
));

CREATE POLICY "Admins and professors can create export logs"
ON public.ai_export_logs FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'professor')
));
