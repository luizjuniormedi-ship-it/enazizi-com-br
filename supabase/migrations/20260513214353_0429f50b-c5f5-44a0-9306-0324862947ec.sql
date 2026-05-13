-- Create the archive table
CREATE TABLE IF NOT EXISTS public.archived_questions_bank (
    LIKE public.questions_bank INCLUDING ALL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    archive_reason TEXT
);

-- Move non-standard questions to quarantine
-- Criteria 1: Not 4 options
INSERT INTO public.archived_questions_bank (
    id, user_id, organization_id, source, statement, options, correct_index, explanation, topic, 
    created_at, is_global, review_status, original_question_id, difficulty, exam_bank_id, 
    question_order, image_url, source_type, permission_type, source_url, subtopic, language, 
    quality_tier, source_map_id, specialty_id, topic_id, subtopic_id, microtopic_id, 
    classification_confidence, classification_method, classification_reviewed_by_human, classified_at,
    archive_reason
)
SELECT 
    id, user_id, organization_id, source, statement, options, correct_index, explanation, topic, 
    created_at, is_global, review_status, original_question_id, difficulty, exam_bank_id, 
    question_order, image_url, source_type, permission_type, source_url, subtopic, language, 
    quality_tier, source_map_id, specialty_id, topic_id, subtopic_id, microtopic_id, 
    classification_confidence, classification_method, classification_reviewed_by_human, classified_at,
    'Incorrect number of options (Not A-D)'
FROM public.questions_bank
WHERE jsonb_array_length(options) != 4;

DELETE FROM public.questions_bank
WHERE jsonb_array_length(options) != 4;

-- Criteria 2: Null critical fields
INSERT INTO public.archived_questions_bank (
    id, user_id, organization_id, source, statement, options, correct_index, explanation, topic, 
    created_at, is_global, review_status, original_question_id, difficulty, exam_bank_id, 
    question_order, image_url, source_type, permission_type, source_url, subtopic, language, 
    quality_tier, source_map_id, specialty_id, topic_id, subtopic_id, microtopic_id, 
    classification_confidence, classification_method, classification_reviewed_by_human, classified_at,
    archive_reason
)
SELECT 
    id, user_id, organization_id, source, statement, options, correct_index, explanation, topic, 
    created_at, is_global, review_status, original_question_id, difficulty, exam_bank_id, 
    question_order, image_url, source_type, permission_type, source_url, subtopic, language, 
    quality_tier, source_map_id, specialty_id, topic_id, subtopic_id, microtopic_id, 
    classification_confidence, classification_method, classification_reviewed_by_human, classified_at,
    'Null critical data (statement, options, correct_index, or explanation)'
FROM public.questions_bank
WHERE statement IS NULL OR options IS NULL OR correct_index IS NULL OR explanation IS NULL;

DELETE FROM public.questions_bank
WHERE statement IS NULL OR options IS NULL OR correct_index IS NULL OR explanation IS NULL;

-- Clean orphan simulation sessions (where question_id in session_data is no longer in questions_bank)
-- This is a bit complex depending on session_data structure. 
-- Usually, we might just want to mark them or move them if they are useless.
-- For now, let's just create an archive for them if they reference deleted questions.
CREATE TABLE IF NOT EXISTS public.archived_simulation_sessions (
    LIKE public.simulation_sessions INCLUDING ALL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Note: We don't delete simulation sessions yet as they might have useful history, 
-- but we mark sessions that might be inconsistent.
