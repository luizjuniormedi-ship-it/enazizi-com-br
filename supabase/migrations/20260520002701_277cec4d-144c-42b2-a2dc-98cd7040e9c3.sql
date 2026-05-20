-- Add subtopic column to flashcards
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS subtopic TEXT;

-- Create view for questions by topic
CREATE OR REPLACE VIEW public.questions_by_topic AS
SELECT 
    topic, 
    subtopic, 
    COUNT(*) as question_count
FROM public.real_exam_questions
GROUP BY topic, subtopic
ORDER BY topic, question_count DESC;

-- Create view for questions coverage
CREATE OR REPLACE VIEW public.questions_coverage AS
SELECT 
    topic, 
    COUNT(DISTINCT subtopic) as subtopic_count,
    COUNT(*) as total_questions
FROM public.real_exam_questions
GROUP BY topic
ORDER BY total_questions DESC;
