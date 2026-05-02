ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cme_render_jobs_config ON public.cme_render_jobs USING gin(config);

NOTIFY pgrst, 'reload schema';