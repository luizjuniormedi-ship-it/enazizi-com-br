-- Add missing scoring columns to questions_bank
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS realism_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reasoning_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS guideline_score INTEGER DEFAULT 0;

-- Ensure quality_tier has correct values (using text for flexibility but documenting expected values)
-- GOLD, SILVER, BASIC, REJECTED

-- Add index for quality_tier to speed up pipeline fetching
CREATE INDEX IF NOT EXISTS idx_questions_bank_quality_tier ON public.questions_bank(quality_tier);
CREATE INDEX IF NOT EXISTS idx_questions_bank_review_status ON public.questions_bank(review_status);

-- Ensure pipeline_governance can handle enrichment logs
-- (Assuming it already has a metadata or details column)
