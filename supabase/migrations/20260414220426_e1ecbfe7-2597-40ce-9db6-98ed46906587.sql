ALTER TABLE public.medical_image_assets
  ADD COLUMN IF NOT EXISTS ai_validated boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_type text DEFAULT NULL;