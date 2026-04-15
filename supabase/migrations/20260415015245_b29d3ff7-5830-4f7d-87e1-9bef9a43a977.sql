
-- Drop old FK that points to legacy medical_images table
ALTER TABLE public.medical_image_attempts 
  DROP CONSTRAINT IF EXISTS medical_image_attempts_image_id_fkey;

-- Add asset_id column for proper linking
ALTER TABLE public.medical_image_attempts 
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.medical_image_assets(id);

-- Make image_id nullable (it was referencing wrong table)
ALTER TABLE public.medical_image_attempts 
  ALTER COLUMN image_id DROP NOT NULL;

-- Fix question_generated flag for assets that already have published questions
UPDATE public.medical_image_assets 
SET question_generated = true 
WHERE id IN (
  SELECT DISTINCT asset_id FROM public.medical_image_questions WHERE status = 'published'
) AND question_generated = false;
