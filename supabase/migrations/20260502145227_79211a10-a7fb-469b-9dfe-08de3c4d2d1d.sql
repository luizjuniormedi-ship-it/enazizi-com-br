-- Create tutor_lesson_memory table
CREATE TABLE IF NOT EXISTS public.tutor_lesson_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    subtitle TEXT,
    subject TEXT,
    topic TEXT,
    subtopic TEXT,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'in_production', 'needs_adjustment', 'ready_to_publish', 'published', 'unpublished', 'archived', 'rejected', 'deleted')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Content Structure (JSONB for flexibility)
    structured_content JSONB DEFAULT '{}'::jsonb,
    
    -- Video/Storage
    video_url TEXT,
    thumbnail_url TEXT,
    duration INTEGER DEFAULT 0, -- in seconds
    
    -- Metadata
    source_session_id UUID REFERENCES public.tutor_sessions(id) ON DELETE SET NULL,
    teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- assigned professor
    
    -- Soft Delete
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES auth.users(id),
    delete_reason TEXT,
    hidden_from_student BOOLEAN DEFAULT false,
    hard_deleted BOOLEAN DEFAULT false,
    
    -- Visibility
    is_favorite BOOLEAN DEFAULT false,
    is_recommended BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- Indexing
CREATE INDEX idx_tutor_lesson_user ON public.tutor_lesson_memory(user_id);
CREATE INDEX idx_tutor_lesson_status ON public.tutor_lesson_memory(status);
CREATE INDEX idx_tutor_lesson_subject ON public.tutor_lesson_memory(subject);

-- Create tutor_lesson_events for auditing
CREATE TABLE IF NOT EXISTS public.tutor_lesson_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.tutor_lesson_memory(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create tutor_lesson_progress for tracking
CREATE TABLE IF NOT EXISTS public.tutor_lesson_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.tutor_lesson_memory(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    progress_percent INTEGER DEFAULT 0,
    last_position INTEGER DEFAULT 0, -- in seconds
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(lesson_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tutor_lesson_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_lesson_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_lesson_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tutor_lesson_memory
CREATE POLICY "Students can view their own non-deleted lessons" 
ON public.tutor_lesson_memory 
FOR SELECT 
USING (auth.uid() = user_id AND status != 'deleted' AND hidden_from_student = false);

CREATE POLICY "Admins can view all lessons" 
ON public.tutor_lesson_memory 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'professor' OR role = 'ceo')));

CREATE POLICY "Admins can insert lessons" 
ON public.tutor_lesson_memory 
FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'professor' OR role = 'ceo')));

CREATE POLICY "Admins can update lessons" 
ON public.tutor_lesson_memory 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'professor' OR role = 'ceo')));

-- Students can insert their own requests (status pending_review)
CREATE POLICY "Students can request lessons" 
ON public.tutor_lesson_memory 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND status = 'pending_review');

-- RLS Policies for progress
CREATE POLICY "Users can track their own progress" 
ON public.tutor_lesson_progress 
FOR ALL 
USING (auth.uid() = user_id);

-- Storage bucket for videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tutor-lesson-videos', 'tutor-lesson-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can upload videos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'tutor-lesson-videos' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'professor' OR role = 'ceo')));

CREATE POLICY "Students can read videos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'tutor-lesson-videos');

-- Function for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_tutor_lesson_memory_updated_at
BEFORE UPDATE ON public.tutor_lesson_memory
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_tutor_lesson_progress_updated_at
BEFORE UPDATE ON public.tutor_lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
