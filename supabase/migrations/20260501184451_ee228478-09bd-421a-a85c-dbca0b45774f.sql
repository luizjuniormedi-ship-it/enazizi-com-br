-- Phase 1: Media Validation Logs
CREATE TABLE IF NOT EXISTS public.cme_media_validation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    validation_type TEXT NOT NULL, -- 'hls', 'mp4', 'subtitle', 'thumbnail', 'chapters'
    validation_status TEXT NOT NULL, -- 'success', 'failure', 'warning'
    checked_url TEXT,
    response_code INTEGER,
    mime_type TEXT,
    latency_ms INTEGER,
    detected_issue TEXT,
    recommendation TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Phase 2: Automatic Reprocessing Jobs
CREATE TABLE IF NOT EXISTS public.cme_media_reprocessing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    render_job_id TEXT, -- ID from external render worker
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    reprocess_status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed', 'cancelled'
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    error_log TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Evolution of ai_video_lessons table for monitoring
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS last_validation_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS health_score NUMERIC DEFAULT 100;
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS cdn_provider TEXT DEFAULT 'supabase-storage';

-- Indexing for governance queries
CREATE INDEX IF NOT EXISTS idx_cme_validation_lesson ON public.cme_media_validation_logs(video_lesson_id);
CREATE INDEX IF NOT EXISTS idx_cme_reprocess_lesson ON public.cme_media_reprocessing_jobs(video_lesson_id);
CREATE INDEX IF NOT EXISTS idx_cme_reprocess_status ON public.cme_media_reprocessing_jobs(reprocess_status);

-- Function to calculate Health Score
CREATE OR REPLACE FUNCTION public.calculate_cme_media_health_score(lesson_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    fail_count INTEGER;
    total_validations INTEGER;
    score NUMERIC;
BEGIN
    SELECT COUNT(*) INTO total_validations FROM public.cme_media_validation_logs WHERE video_lesson_id = lesson_id;
    IF total_validations = 0 THEN RETURN 100; END IF;
    
    SELECT COUNT(*) INTO fail_count FROM public.cme_media_validation_logs 
    WHERE video_lesson_id = lesson_id AND validation_status = 'failure';
    
    score := 100 - (LEAST(fail_count * 20, 100));
    RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.cme_media_validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_media_reprocessing_jobs ENABLE ROW LEVEL SECURITY;

-- Policies (Admin/Worker access)
CREATE POLICY "Admins can view validation logs" ON public.cme_media_validation_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can view reprocessing jobs" ON public.cme_media_reprocessing_jobs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage reprocessing jobs" ON public.cme_media_reprocessing_jobs FOR ALL TO authenticated USING (true);

-- Update trigger for health score
CREATE OR REPLACE FUNCTION public.trigger_update_cme_health_score()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.ai_video_lessons 
    SET health_score = calculate_cme_media_health_score(NEW.video_lesson_id),
        last_validation_at = now()
    WHERE id = NEW.video_lesson_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_health_score_on_validation
AFTER INSERT ON public.cme_media_validation_logs
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_cme_health_score();
