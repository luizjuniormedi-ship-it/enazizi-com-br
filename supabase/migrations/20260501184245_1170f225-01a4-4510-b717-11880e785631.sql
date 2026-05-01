-- Allow 'failed' and 'rendering' in media_status
ALTER TABLE public.ai_video_lessons DROP CONSTRAINT IF EXISTS ai_video_lessons_media_status_check;
ALTER TABLE public.ai_video_lessons ADD CONSTRAINT ai_video_lessons_media_status_check 
CHECK (media_status = ANY (ARRAY['draft'::text, 'video_generated'::text, 'reviewed'::text, 'ready_for_students'::text, 'published'::text, 'failed'::text, 'rendering'::text, 'ready'::text]));

-- Add error tracking
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS pipeline_last_error TEXT;

-- Validation function for media
CREATE OR REPLACE FUNCTION public.check_video_lesson_media_validity()
RETURNS TRIGGER AS $$
DECLARE
    playback_url TEXT;
BEGIN
    -- Only check when status becomes 'published'
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        playback_url := COALESCE(NEW.hls_url, NEW.video_url, NEW.playback_url);
        
        -- Check if URL is present
        IF playback_url IS NULL OR playback_url = '' THEN
            RAISE EXCEPTION 'Impossível publicar: Nenhuma URL de mídia vinculada.';
        END IF;

        -- Check for placeholders
        IF playback_url LIKE '%example.com%' OR 
           playback_url LIKE '%placeholder%' OR 
           playback_url LIKE '%dummy%' OR
           playback_url LIKE 'http://localhost%' THEN
            RAISE EXCEPTION 'Impossível publicar: URL placeholder detectada (%).', playback_url;
        END IF;

        -- Check media status
        IF NEW.media_status NOT IN ('ready', 'published', 'ready_for_students') THEN
            RAISE EXCEPTION 'Impossível publicar: Mídia ainda em status %.', NEW.media_status;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for publication enforcement
DROP TRIGGER IF EXISTS enforce_video_media_validity ON public.ai_video_lessons;
CREATE TRIGGER enforce_video_media_validity
BEFORE INSERT OR UPDATE ON public.ai_video_lessons
FOR EACH ROW
EXECUTE FUNCTION public.check_video_lesson_media_validity();
