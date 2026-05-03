-- Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Add metadata column to tutor_lesson_memory if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_lesson_memory' AND column_name = 'metadata') THEN
        ALTER TABLE public.tutor_lesson_memory ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Add topic_normalized column for searching
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tutor_lesson_memory' AND column_name = 'topic_normalized') THEN
        ALTER TABLE public.tutor_lesson_memory ADD COLUMN topic_normalized TEXT;
    END IF;
END $$;

-- Create index for topic_normalized
CREATE INDEX IF NOT EXISTS idx_tutor_lesson_topic_normalized ON public.tutor_lesson_memory (topic_normalized);

-- Function to normalize text
CREATE OR REPLACE FUNCTION public.normalize_medical_topic(t TEXT) RETURNS TEXT AS $$
BEGIN
  IF t IS NULL THEN RETURN NULL; END IF;
  RETURN trim(lower(unaccent(t)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to keep topic_normalized updated
CREATE OR REPLACE FUNCTION public.trig_update_topic_normalized() RETURNS TRIGGER AS $$
BEGIN
  NEW.topic_normalized := public.normalize_medical_topic(NEW.topic);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tutor_lesson_normalize_topic ON public.tutor_lesson_memory;
CREATE TRIGGER tr_tutor_lesson_normalize_topic
BEFORE INSERT OR UPDATE OF topic ON public.tutor_lesson_memory
FOR EACH ROW EXECUTE FUNCTION public.trig_update_topic_normalized();

-- Backfill existing records
UPDATE public.tutor_lesson_memory SET topic_normalized = public.normalize_medical_topic(topic) WHERE topic_normalized IS NULL;
