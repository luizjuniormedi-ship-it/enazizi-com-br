ALTER TABLE public.visual_skill_snapshots
  ALTER COLUMN strongest_area DROP NOT NULL,
  ALTER COLUMN weakest_area DROP NOT NULL;