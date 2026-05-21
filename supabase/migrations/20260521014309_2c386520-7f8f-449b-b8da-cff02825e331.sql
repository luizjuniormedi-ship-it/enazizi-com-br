
ALTER TABLE public.tutor_runtime_metrics
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS function_name TEXT,
  ADD COLUMN IF NOT EXISTS memory_lookup_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS persistence_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_key_recovered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS streaming_truncated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS model_used TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tutor_runtime_metrics_user_created
  ON public.tutor_runtime_metrics (user_id, created_at DESC);
