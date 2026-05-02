ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;
NOTIFY pgrst, 'reload schema';