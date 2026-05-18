-- Add missing columns to tutor_lesson_memory
ALTER TABLE public.tutor_lesson_memory ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;
ALTER TABLE public.tutor_lesson_memory ADD COLUMN IF NOT EXISTS organization_id UUID;
