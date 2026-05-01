-- Create cme_exam_sprint_profiles table
CREATE TABLE IF NOT EXISTS public.cme_exam_sprint_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES public.ai_video_lessons(id) ON DELETE CASCADE,
    sprint_duration INTEGER NOT NULL, -- duration in seconds
    retention_focus TEXT NOT NULL, -- e.g., 'exam_tricks', 'high_yield', 'final_review'
    exam_density DECIMAL NOT NULL, -- 0.0 to 1.0
    sprint_score DECIMAL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_exam_sprint_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view sprint profiles for published lessons" 
ON public.cme_exam_sprint_profiles 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.ai_video_lessons 
        WHERE id = lesson_id AND (status = 'published' OR status = 'ready')
    )
);

-- Ensure public access for ai_video_lessons (only basic info)
CREATE POLICY "Public can view basic lesson info" 
ON public.ai_video_lessons 
FOR SELECT 
USING (status = 'published');