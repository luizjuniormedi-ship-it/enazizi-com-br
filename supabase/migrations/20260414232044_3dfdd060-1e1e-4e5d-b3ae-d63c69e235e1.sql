ALTER TABLE public.medical_image_questions
  ADD COLUMN IF NOT EXISTS discussion jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS exam_tips text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pitfalls text[] DEFAULT '{}';