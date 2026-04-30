-- Expand content_status enum with formal review stages
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'ai_generated';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'pedagogical_review';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'scientific_review';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'failed';

-- Specialized Prompt Management
CREATE TABLE IF NOT EXISTS public.medical_ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialty TEXT NOT NULL,
    prompt_name TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    review_prompt TEXT,
    feynman_prompt TEXT,
    flashcard_prompt TEXT,
    quiz_prompt TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for prompts
ALTER TABLE public.medical_ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and professors can manage prompts"
ON public.medical_ai_prompts FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'professor')
));

-- Enhance pedagogical_reviews with scientific and clinical metrics
ALTER TABLE public.pedagogical_reviews 
ADD COLUMN IF NOT EXISTS adherence_to_guidelines_score INTEGER CHECK (adherence_to_guidelines_score >= 0 AND adherence_to_guidelines_score <= 10),
ADD COLUMN IF NOT EXISTS clinical_safety_score INTEGER CHECK (clinical_safety_score >= 0 AND clinical_safety_score <= 10),
ADD COLUMN IF NOT EXISTS exam_utility_score INTEGER CHECK (exam_utility_score >= 0 AND exam_utility_score <= 10),
ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT 'pedagogical' CHECK (review_type IN ('pedagogical', 'scientific')),
ADD COLUMN IF NOT EXISTS specific_specialist_id UUID REFERENCES auth.users(id);

-- Reliability score update logic enhancement
CREATE OR REPLACE FUNCTION public.calculate_content_reliability()
RETURNS TRIGGER AS $$
DECLARE
    avg_precision NUMERIC;
    avg_safety NUMERIC;
    avg_didactic NUMERIC;
    avg_adherence NUMERIC;
    final_score NUMERIC;
    total_reviews INTEGER;
BEGIN
    SELECT 
        AVG(precision_score), 
        AVG(clinical_safety_score),
        AVG(didactic_score * 2),
        AVG(adherence_to_guidelines_score),
        COUNT(*)
    INTO 
        avg_precision, 
        avg_safety, 
        avg_didactic, 
        avg_adherence,
        total_reviews
    FROM public.pedagogical_reviews
    WHERE content_id = NEW.content_id;

    -- Scientific and Safety carry 60% of weight in Medical Reliability
    final_score := (
        (COALESCE(avg_precision, 0) * 0.3) + 
        (COALESCE(avg_safety, 0) * 0.3) + 
        (COALESCE(avg_adherence, 0) * 0.2) + 
        (COALESCE(avg_didactic, 0) * 0.2)
    ) * 10;

    UPDATE public.master_content_library
    SET 
        reliability_score = final_score,
        is_gold_standard = (final_score >= 90 AND total_reviews >= 2),
        updated_at = now()
    WHERE id = NEW.content_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for reliability update
DROP TRIGGER IF EXISTS tr_calculate_reliability ON public.pedagogical_reviews;
CREATE TRIGGER tr_calculate_reliability
AFTER INSERT OR UPDATE ON public.pedagogical_reviews
FOR EACH ROW EXECUTE FUNCTION public.calculate_content_reliability();
