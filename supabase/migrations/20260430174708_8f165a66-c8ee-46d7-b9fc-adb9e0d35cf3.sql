-- Update pedagogical_reviews table to support 0-10 granular scoring
ALTER TABLE public.pedagogical_reviews 
ADD COLUMN IF NOT EXISTS precision_score INTEGER CHECK (precision_score >= 0 AND precision_score <= 10),
ADD COLUMN IF NOT EXISTS clarity_score INTEGER CHECK (clarity_score >= 0 AND clarity_score <= 10),
ADD COLUMN IF NOT EXISTS depth_score INTEGER CHECK (depth_score >= 0 AND depth_score <= 10),
ADD COLUMN IF NOT EXISTS flashcards_quality_score INTEGER CHECK (flashcards_quality_score >= 0 AND flashcards_quality_score <= 10),
ADD COLUMN IF NOT EXISTS quiz_quality_score INTEGER CHECK (quiz_quality_score >= 0 AND quiz_quality_score <= 10),
ADD COLUMN IF NOT EXISTS feynman_quality_score INTEGER CHECK (feynman_quality_score >= 0 AND feynman_quality_score <= 10),
ADD COLUMN IF NOT EXISTS correction_count INTEGER DEFAULT 0;

-- Add reliability and gold standard status to master_content_library
ALTER TABLE public.master_content_library 
ADD COLUMN IF NOT EXISTS reliability_score NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_gold_standard BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manual_correction_log JSONB DEFAULT '[]'::jsonb;

-- Function to calculate Reliability Score and Gold Standard status
CREATE OR REPLACE FUNCTION calculate_content_reliability()
RETURNS TRIGGER AS $$
DECLARE
    avg_precision NUMERIC;
    avg_clarity NUMERIC;
    avg_didactic NUMERIC;
    avg_depth NUMERIC;
    final_score NUMERIC;
    total_reviews INTEGER;
BEGIN
    -- Calculate averages for the specific content
    SELECT 
        AVG(precision_score), 
        AVG(clarity_score), 
        AVG(didactic_score * 2), -- Normalize 1-5 to 0-10
        AVG(depth_score),
        COUNT(*)
    INTO 
        avg_precision, 
        avg_clarity, 
        avg_didactic, 
        avg_depth,
        total_reviews
    FROM public.pedagogical_reviews
    WHERE content_id = NEW.content_id;

    -- Weighted score (Precision and Didactic carry more weight in Medicine)
    final_score := (
        (COALESCE(avg_precision, 0) * 0.4) + 
        (COALESCE(avg_didactic, 0) * 0.3) + 
        (COALESCE(avg_clarity, 0) * 0.15) + 
        (COALESCE(avg_depth, 0) * 0.15)
    ) * 10; -- Scale to percentage (0-100)

    -- Update the master library
    UPDATE public.master_content_library
    SET 
        reliability_score = final_score,
        is_gold_standard = (final_score >= 90 AND total_reviews >= 1),
        updated_at = now()
    WHERE id = NEW.content_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for reliability update
DROP TRIGGER IF EXISTS tr_calculate_reliability ON public.pedagogical_reviews;
CREATE TRIGGER tr_calculate_reliability
AFTER INSERT OR UPDATE ON public.pedagogical_reviews
FOR EACH ROW EXECUTE FUNCTION calculate_content_reliability();
