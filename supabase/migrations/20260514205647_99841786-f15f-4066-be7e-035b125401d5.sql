-- Expand questions_bank for Enterprise 2026
ALTER TABLE public.questions_bank
ADD COLUMN IF NOT EXISTS board TEXT,
ADD COLUMN IF NOT EXISTS institution TEXT,
ADD COLUMN IF NOT EXISTS year INTEGER,
ADD COLUMN IF NOT EXISTS tutor_context TEXT,
ADD COLUMN IF NOT EXISTS fsrs_hooks JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_pdf TEXT,
ADD COLUMN IF NOT EXISTS ingestion_version TEXT,
ADD COLUMN IF NOT EXISTS approved_for_generation BOOLEAN DEFAULT TRUE;

-- Expand flashcards for Enterprise 2026
ALTER TABLE public.flashcards
ADD COLUMN IF NOT EXISTS retention_score DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS urgency_score DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS fsrs_integration_data JSONB DEFAULT '{}';

-- Expand clinical_guidelines
ALTER TABLE public.clinical_guidelines
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Create cognitive_telemetry table
CREATE TABLE IF NOT EXISTS public.cognitive_telemetry (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions_bank(id) ON DELETE SET NULL,
    flashcard_id UUID REFERENCES public.flashcards(id) ON DELETE SET NULL,
    response_time_ms INTEGER,
    alternative_changed BOOLEAN DEFAULT FALSE,
    perceived_difficulty INTEGER, -- 1-5
    confidence_level INTEGER, -- 1-5
    fatigue_score INTEGER, -- 1-5
    is_abandoned BOOLEAN DEFAULT FALSE,
    needs_review BOOLEAN DEFAULT FALSE,
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for cognitive_telemetry
ALTER TABLE public.cognitive_telemetry ENABLE ROW LEVEL SECURITY;

-- Policies for cognitive_telemetry
CREATE POLICY "Users can insert their own telemetry"
ON public.cognitive_telemetry
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own telemetry"
ON public.cognitive_telemetry
FOR SELECT
USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_bank_official_exam ON public.questions_bank(official_exam_flag) WHERE official_exam_flag IS TRUE;
CREATE INDEX IF NOT EXISTS idx_questions_bank_source ON public.questions_bank(source);
CREATE INDEX IF NOT EXISTS idx_flashcards_global ON public.flashcards(is_global) WHERE is_global IS TRUE;
CREATE INDEX IF NOT EXISTS idx_cognitive_telemetry_user ON public.cognitive_telemetry(user_id);
