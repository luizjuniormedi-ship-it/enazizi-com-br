-- Add columns to real_exam_questions
ALTER TABLE public.real_exam_questions 
ADD COLUMN IF NOT EXISTS board TEXT,
ADD COLUMN IF NOT EXISTS year INTEGER,
ADD COLUMN IF NOT EXISTS institution TEXT,
ADD COLUMN IF NOT EXISTS subtopic TEXT,
ADD COLUMN IF NOT EXISTS difficulty_level INTEGER,
ADD COLUMN IF NOT EXISTS is_clinical_case BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add columns to questions_bank (some might already exist or need matching)
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS subtopic TEXT,
ADD COLUMN IF NOT EXISTS difficulty_level INTEGER,
ADD COLUMN IF NOT EXISTS is_clinical_case BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Update shared types or just rely on dynamic access in functions
-- The functions already try to insert these columns.