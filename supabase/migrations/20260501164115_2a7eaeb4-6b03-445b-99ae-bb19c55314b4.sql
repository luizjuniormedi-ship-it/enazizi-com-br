ALTER TABLE public.ai_video_lessons 
ADD COLUMN IF NOT EXISTS notebooklm_video_url TEXT,
ADD COLUMN IF NOT EXISTS media_status TEXT DEFAULT 'draft' CHECK (media_status IN ('draft', 'video_generated', 'reviewed', 'ready_for_students', 'published'));
