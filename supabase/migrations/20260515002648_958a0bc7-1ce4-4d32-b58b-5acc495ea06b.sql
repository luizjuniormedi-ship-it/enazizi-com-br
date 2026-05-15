-- Ensure columns exist in official_exam_files
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='official_exam_files' AND column_name='detected_year') THEN
        ALTER TABLE public.official_exam_files ADD COLUMN detected_year INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='official_exam_files' AND column_name='detected_category') THEN
        ALTER TABLE public.official_exam_files ADD COLUMN detected_category TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name='official_exam_files' AND column_name='hash_sha256') THEN
        ALTER TABLE public.official_exam_files ADD COLUMN hash_sha256 TEXT;
    END IF;
END $$;
