-- Fix strongest_area and weakest_area: boolean → text
ALTER TABLE public.visual_skill_snapshots
  ALTER COLUMN strongest_area TYPE text USING NULL,
  ALTER COLUMN weakest_area TYPE text USING NULL;

-- Ensure image_id is nullable (it's a legacy column)
ALTER TABLE public.medical_image_attempts
  ALTER COLUMN image_id DROP NOT NULL;

-- Set default null for image_id
ALTER TABLE public.medical_image_attempts
  ALTER COLUMN image_id SET DEFAULT NULL;