-- Add missing URL columns for real media handling
ALTER TABLE public.ai_video_lessons 
ADD COLUMN IF NOT EXISTS hls_url TEXT,
ADD COLUMN IF NOT EXISTS playback_url TEXT,
ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Update media_status documentation/intent (it's a text column)
-- We'll also ensure it has a default value if not already set
ALTER TABLE public.ai_video_lessons 
ALTER COLUMN media_status SET DEFAULT 'queued';

-- Add a comment for documentation
COMMENT ON COLUMN public.ai_video_lessons.media_status IS 'Status of the media processing: queued, rendering, processing, ready, failed';
