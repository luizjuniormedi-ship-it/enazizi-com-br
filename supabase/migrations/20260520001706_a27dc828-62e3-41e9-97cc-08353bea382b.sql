-- FLASHCARDS INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    topic TEXT,
    discipline TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flashcard_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, extracting, generating, completed, error
    extracted_text TEXT,
    total_cards_generated INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure fsrs_cards has the required longitudinal fields
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES public.flashcard_decks(id);
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS discipline TEXT;
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS front TEXT;
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS back TEXT;
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS retrievability FLOAT;
ALTER TABLE public.fsrs_cards ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMP WITH TIME ZONE;

-- SIMULADOS INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS public.simulado_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL, -- estudo, prova, adaptativo
    status TEXT DEFAULT 'active', -- active, finished, abandoned
    total_questions INTEGER NOT NULL,
    correct_count INTEGER DEFAULT 0,
    score FLOAT DEFAULT 0,
    time_limit_seconds INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.simulado_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.simulado_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions_bank(id),
    order_index INTEGER NOT NULL,
    selected_answer INTEGER, -- index da alternativa
    is_correct BOOLEAN,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS POLICIES
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_questions ENABLE ROW LEVEL SECURITY;

-- Individual Policy Creation (Avoiding the loop error)
DROP POLICY IF EXISTS "Users can manage their own flashcard_decks" ON public.flashcard_decks;
CREATE POLICY "Users can manage their own flashcard_decks" ON public.flashcard_decks FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own flashcard_uploads" ON public.flashcard_uploads;
CREATE POLICY "Users can manage their own flashcard_uploads" ON public.flashcard_uploads FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own simulado_sessions" ON public.simulado_sessions;
CREATE POLICY "Users can manage their own simulado_sessions" ON public.simulado_sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own simulado_questions" ON public.simulado_questions;
CREATE POLICY "Users can manage their own simulado_questions" ON public.simulado_questions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.simulado_sessions 
        WHERE id = session_id AND user_id = auth.uid()
    )
);
