-- Adapt existing pipeline_alerts table
ALTER TABLE public.pipeline_alerts 
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS error_stack TEXT,
ADD COLUMN IF NOT EXISTS payload JSONB,
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS http_status INTEGER;

-- Migrate existing alert_type to source if it exists
UPDATE public.pipeline_alerts SET source = alert_type WHERE source IS NULL AND alert_type IS NOT NULL;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_pipeline_alerts_source ON public.pipeline_alerts(source);
CREATE INDEX IF NOT EXISTS idx_pipeline_alerts_model ON public.pipeline_alerts(model_used);
