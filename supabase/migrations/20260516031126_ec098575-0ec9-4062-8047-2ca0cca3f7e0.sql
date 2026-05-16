ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS clinical_density_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS board_similarity_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS guideline_relevancy_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS distractor_quality_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reasoning_complexity_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS retention_value_score NUMERIC DEFAULT 0;

-- Create a view for Question Quality Analytics
CREATE OR REPLACE VIEW public.question_quality_analytics AS
SELECT 
    topic,
    subtopic,
    AVG(clinical_density_score) as avg_density,
    AVG(reasoning_complexity_score) as avg_complexity,
    AVG(distractor_quality_score) as avg_distractor,
    COUNT(*) as question_count
FROM public.questions_bank
GROUP BY topic, subtopic;
