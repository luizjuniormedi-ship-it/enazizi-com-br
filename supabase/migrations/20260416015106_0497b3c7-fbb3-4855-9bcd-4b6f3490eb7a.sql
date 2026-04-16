
-- Add source_map_id to flashcards
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS source_map_id UUID REFERENCES public.mental_maps(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_flashcards_source_map ON public.flashcards(source_map_id) WHERE source_map_id IS NOT NULL;

-- Add source_map_id to questions_bank
ALTER TABLE public.questions_bank ADD COLUMN IF NOT EXISTS source_map_id UUID REFERENCES public.mental_maps(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_questions_bank_source_map ON public.questions_bank(source_map_id) WHERE source_map_id IS NOT NULL;

-- Add derived content counters to mental_maps
ALTER TABLE public.mental_maps ADD COLUMN IF NOT EXISTS flashcards_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.mental_maps ADD COLUMN IF NOT EXISTS questions_count INTEGER NOT NULL DEFAULT 0;
