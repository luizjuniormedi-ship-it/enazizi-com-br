-- Table for detailed tutor video recommendation telemetry
CREATE TABLE IF NOT EXISTS public.tutor_video_recommendation_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT,
    lesson_id UUID REFERENCES public.tutor_lesson_memory(id) ON DELETE SET NULL,
    topic TEXT NOT NULL,
    event_type TEXT NOT NULL, -- search_started, found, not_found, shown, clicked, skipped_unpublished, etc.
    confidence FLOAT,
    source_table TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_video_recommendation_telemetry ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own telemetry"
ON public.tutor_video_recommendation_telemetry
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all telemetry"
ON public.tutor_video_recommendation_telemetry
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_tutor_video_telemetry_user ON public.tutor_video_recommendation_telemetry(user_id);
CREATE INDEX idx_tutor_video_telemetry_topic ON public.tutor_video_recommendation_telemetry(topic);
CREATE INDEX idx_tutor_video_telemetry_event ON public.tutor_video_recommendation_telemetry(event_type);
