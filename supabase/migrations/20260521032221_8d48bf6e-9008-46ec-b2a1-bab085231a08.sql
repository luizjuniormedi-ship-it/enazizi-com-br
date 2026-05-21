-- Audit and fix tutor_learning_memory schema
DO $$ 
BEGIN
    -- Add created_at if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tutor_learning_memory' AND COLUMN_NAME = 'created_at') THEN
        ALTER TABLE public.tutor_learning_memory ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;

    -- Add mastery_level if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tutor_learning_memory' AND COLUMN_NAME = 'mastery_level') THEN
        ALTER TABLE public.tutor_learning_memory ADD COLUMN mastery_level TEXT DEFAULT 'initial';
    END IF;

    -- Add misconceptions_detected if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tutor_learning_memory' AND COLUMN_NAME = 'misconceptions_detected') THEN
        ALTER TABLE public.tutor_learning_memory ADD COLUMN misconceptions_detected TEXT[];
    END IF;

    -- Add explanation_summary if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tutor_learning_memory' AND COLUMN_NAME = 'explanation_summary') THEN
        ALTER TABLE public.tutor_learning_memory ADD COLUMN explanation_summary TEXT;
    END IF;

    -- Add generated_content if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tutor_learning_memory' AND COLUMN_NAME = 'generated_content') THEN
        ALTER TABLE public.tutor_learning_memory ADD COLUMN generated_content JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add block_title if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tutor_learning_memory' AND COLUMN_NAME = 'block_title') THEN
        ALTER TABLE public.tutor_learning_memory ADD COLUMN block_title TEXT;
    END IF;

    -- Add subtopic if missing
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tutor_learning_memory' AND COLUMN_NAME = 'subtopic') THEN
        ALTER TABLE public.tutor_learning_memory ADD COLUMN subtopic TEXT;
    END IF;
END $$;

-- Ensure RLS is enabled and policies exist (redundant but safe)
ALTER TABLE public.tutor_learning_memory ENABLE ROW LEVEL SECURITY;

-- If policies don't exist, they will be handled by the system or manual addition if needed, 
-- but according to previous audit they are already there.
