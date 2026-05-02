-- Create Educational Memory table
CREATE TABLE IF NOT EXISTS public.educational_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subtitle TEXT,
    subject TEXT,
    topic TEXT,
    subtopic TEXT,
    source_type TEXT NOT NULL, -- 'tutor_chat','pdf','cme','notebooklm','flashcard','simulado','manual'
    session_id UUID,
    aggregation_id UUID,
    conversation_id UUID,
    generated_summary TEXT,
    short_summary TEXT,
    tags TEXT[] DEFAULT '{}',
    difficulty_level TEXT,
    estimated_duration INTEGER, -- em segundos
    teaching_style TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    access_count INTEGER DEFAULT 0,
    memory_score NUMERIC DEFAULT 0,
    favorite BOOLEAN DEFAULT false,
    archived BOOLEAN DEFAULT false,
    thumbnail_url TEXT,
    status TEXT DEFAULT 'ready',
    metadata JSONB DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.educational_memory ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own memory" 
ON public.educational_memory FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory" 
ON public.educational_memory FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory" 
ON public.educational_memory FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory" 
ON public.educational_memory FOR DELETE 
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_educational_memory_updated_at
    BEFORE UPDATE ON public.educational_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_edu_memory_user_id ON public.educational_memory(user_id);
CREATE INDEX idx_edu_memory_source_type ON public.educational_memory(source_type);
CREATE INDEX idx_edu_memory_subject ON public.educational_memory(subject);
CREATE INDEX idx_edu_memory_topic ON public.educational_memory(topic);
CREATE INDEX idx_edu_memory_created_at ON public.educational_memory(created_at);
CREATE INDEX idx_edu_memory_last_accessed ON public.educational_memory(last_accessed_at);
