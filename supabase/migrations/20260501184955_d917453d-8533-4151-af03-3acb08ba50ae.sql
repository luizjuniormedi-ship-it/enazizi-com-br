-- Table for Incident Management
CREATE TABLE IF NOT EXISTS public.cme_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'investigating', 'reprocessing', 'resolved', 'closed'
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE SET NULL,
    probable_cause TEXT,
    timeline JSONB DEFAULT '[]'::jsonb,
    assigned_to UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for Playback Regression Suite
CREATE TABLE IF NOT EXISTS public.cme_regression_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    test_type TEXT NOT NULL, -- 'hls_load', 'mp4_fallback', 'tutor_sync', 'smart_replay', 'ace_overlay'
    status TEXT NOT NULL, -- 'passed', 'failed', 'warning'
    latency_ms INTEGER,
    error_details TEXT,
    browser_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add monitoring fields to ai_video_lessons
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS last_test_passed BOOLEAN DEFAULT true;
ALTER TABLE public.ai_video_lessons ADD COLUMN IF NOT EXISTS active_incident_count INTEGER DEFAULT 0;

-- Function to handle operational alerts
CREATE OR REPLACE FUNCTION public.trigger_cme_operational_alert()
RETURNS TRIGGER AS $$
DECLARE
    lesson_title TEXT;
BEGIN
    -- Only for failures
    IF NEW.validation_status = 'failure' THEN
        SELECT title INTO lesson_title FROM public.ai_video_lessons WHERE id = NEW.video_lesson_id;
        
        -- Insert into system alerts (if such table exists or log it)
        -- For now, we create an incident automatically for critical failures
        INSERT INTO public.cme_incidents (
            title, 
            description, 
            severity, 
            video_lesson_id, 
            probable_cause
        ) VALUES (
            'Falha de Validação: ' || lesson_title,
            'O validador detectou um problema do tipo ' || NEW.validation_type || ' na URL: ' || NEW.checked_url,
            'high',
            NEW.video_lesson_id,
            NEW.detected_issue
        );
        
        -- Log to multimodal audit for cross-system visibility
        PERFORM log_multimodal_audit(
            'CME_GOVERNANCE',
            'MEDIA_FAILURE_ALERT',
            jsonb_build_object('lesson_id', NEW.video_lesson_id, 'type', NEW.validation_type),
            jsonb_build_object('issue', NEW.detected_issue),
            NEW.latency_ms,
            'error',
            NEW.detected_issue
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for alerts
DROP TRIGGER IF EXISTS on_media_failure_alert ON public.cme_media_validation_logs;
CREATE TRIGGER on_media_failure_alert
AFTER INSERT ON public.cme_media_validation_logs
FOR EACH ROW EXECUTE FUNCTION public.trigger_cme_operational_alert();

-- Enable RLS
ALTER TABLE public.cme_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_regression_tests ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "Admins manage incidents" ON public.cme_incidents FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins view regression tests" ON public.cme_regression_tests FOR SELECT TO authenticated USING (true);
