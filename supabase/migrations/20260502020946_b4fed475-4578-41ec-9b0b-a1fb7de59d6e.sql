ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS generation_id UUID;
CREATE INDEX IF NOT EXISTS idx_cme_render_jobs_generation_id ON public.cme_render_jobs(generation_id);
NOTIFY pgrst, 'reload schema';