-- Add missing columns to existing master_content_library table
ALTER TABLE public.master_content_library 
ADD COLUMN IF NOT EXISTS discipline TEXT,
ADD COLUMN IF NOT EXISTS topic TEXT,
ADD COLUMN IF NOT EXISTS subtopic TEXT,
ADD COLUMN IF NOT EXISTS exam_category TEXT,
ADD COLUMN IF NOT EXISTS generated_summary TEXT,
ADD COLUMN IF NOT EXISTS generated_feynman TEXT,
ADD COLUMN IF NOT EXISTS generated_flashcards JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS generated_quiz JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS generated_questions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS generated_video_script TEXT,
ADD COLUMN IF NOT EXISTS generated_mindmap TEXT,
ADD COLUMN IF NOT EXISTS notebooklm_export_text TEXT,
ADD COLUMN IF NOT EXISTS notebooklm_video_url TEXT,
ADD COLUMN IF NOT EXISTS notebooklm_audio_url TEXT,
ADD COLUMN IF NOT EXISTS notebooklm_notes TEXT,
ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private',
ADD COLUMN IF NOT EXISTS target_groups TEXT[],
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Ensure RLS is active
ALTER TABLE public.master_content_library ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid conflicts if they exist
DROP POLICY IF EXISTS "Admins have full access to master_content_library" ON public.master_content_library;
DROP POLICY IF EXISTS "Students can only see published content" ON public.master_content_library;

-- Create robust policies
CREATE POLICY "Admin/Teacher full access"
ON public.master_content_library
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.user_type IN ('admin', 'teacher', 'master'))
    )
);

CREATE POLICY "Student limited access"
ON public.master_content_library
FOR SELECT
TO authenticated
USING (
    (status::text = 'published') AND (
        visibility = 'public' OR 
        (visibility = 'premium' AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.status = 'active'))
    )
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_mcl_discipline_topic_v2 ON public.master_content_library(discipline, topic, subtopic);
CREATE INDEX IF NOT EXISTS idx_mcl_hash_v2 ON public.master_content_library(content_hash);
