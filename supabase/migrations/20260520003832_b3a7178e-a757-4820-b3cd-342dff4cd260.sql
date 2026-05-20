-- Create flashcard_generation_jobs for background tracking
CREATE TABLE IF NOT EXISTS public.flashcard_generation_jobs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES public.uploads(id) ON DELETE SET NULL,
    topic TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    total_cards_expected INTEGER DEFAULT 0,
    total_cards_generated INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create simulado_answers for detailed answer tracking
CREATE TABLE IF NOT EXISTS public.simulado_answers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.simulado_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions_bank(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    selected_answer INTEGER,
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure RLS
ALTER TABLE public.flashcard_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_answers ENABLE ROW LEVEL SECURITY;

-- Policies for flashcard_generation_jobs
CREATE POLICY "Users can manage their own generation jobs"
ON public.flashcard_generation_jobs
FOR ALL
USING (auth.uid() = user_id);

-- Policies for simulado_answers
CREATE POLICY "Users can manage their own simulado answers"
ON public.simulado_answers
FOR ALL
USING (auth.uid() = user_id);

-- Add missing columns to fsrs_cards if they don't exist (safety check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fsrs_cards' AND column_name='explanation') THEN
        ALTER TABLE public.fsrs_cards ADD COLUMN explanation TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fsrs_cards' AND column_name='difficulty_fsrs') THEN
        ALTER TABLE public.fsrs_cards ADD COLUMN difficulty_fsrs DOUBLE PRECISION;
    END IF;
END $$;

-- Update updated_at trigger for jobs
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_flashcard_generation_jobs_updated_at ON public.flashcard_generation_jobs;
CREATE TRIGGER update_flashcard_generation_jobs_updated_at
BEFORE UPDATE ON public.flashcard_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
