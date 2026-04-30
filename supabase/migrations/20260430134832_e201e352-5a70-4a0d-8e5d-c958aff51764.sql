-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Type for content status
DO $$ BEGIN
    CREATE TYPE public.content_status AS ENUM ('draft', 'processing', 'review', 'approved', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Type for content types
DO $$ BEGIN
    CREATE TYPE public.ai_content_type AS ENUM ('technical_summary', 'feynman_summary', 'flashcards', 'quiz', 'video_script', 'commented_questions');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table for the Master Content Library
CREATE TABLE IF NOT EXISTS public.master_content_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    content_hash TEXT UNIQUE,
    raw_content TEXT,
    generated_data JSONB DEFAULT '{}'::jsonb,
    status public.content_status DEFAULT 'draft',
    created_by UUID REFERENCES auth.users(id),
    reviewed_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    estimated_cost DECIMAL(10, 4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table for AI Generation Queue
CREATE TABLE IF NOT EXISTS public.ai_generation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    task_type public.ai_content_type NOT NULL,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.master_content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins have full access to library"
ON public.master_content_library
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
  )
);

CREATE POLICY "Students can view published content"
ON public.master_content_library
FOR SELECT
TO authenticated
USING (
  status = 'published'
);

CREATE POLICY "Admins have full access to queue"
ON public.ai_generation_queue
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid() AND profiles.user_type = 'admin'
  )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_master_content
BEFORE UPDATE ON public.master_content_library
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();