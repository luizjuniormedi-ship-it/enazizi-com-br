
-- Pipeline progress tracking
CREATE TABLE public.pipeline_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_type TEXT NOT NULL UNIQUE,
  last_processed_index INT NOT NULL DEFAULT 0,
  last_processed_id TEXT,
  total_processed INT NOT NULL DEFAULT 0,
  total_validated INT NOT NULL DEFAULT 0,
  total_generated INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'idle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_progress ENABLE ROW LEVEL SECURITY;

-- Pipeline execution logs
CREATE TABLE public.pipeline_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_type TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'full_pipeline',
  batch_size INT NOT NULL DEFAULT 0,
  items_processed INT NOT NULL DEFAULT 0,
  assets_created INT NOT NULL DEFAULT 0,
  assets_validated INT NOT NULL DEFAULT 0,
  questions_generated INT NOT NULL DEFAULT 0,
  errors INT NOT NULL DEFAULT 0,
  error_details JSONB,
  execution_time_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY;

-- Pipeline concurrency lock
CREATE TABLE public.pipeline_lock (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_running BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  dataset_type TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_lock ENABLE ROW LEVEL SECURITY;
INSERT INTO public.pipeline_lock (id, is_running) VALUES (1, false);

-- Add question_generated flag to assets
ALTER TABLE public.medical_image_assets ADD COLUMN IF NOT EXISTS question_generated BOOLEAN NOT NULL DEFAULT false;

-- Initialize progress rows
INSERT INTO public.pipeline_progress (dataset_type) VALUES ('xray'), ('ecg')
ON CONFLICT (dataset_type) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER set_pipeline_progress_updated_at
  BEFORE UPDATE ON public.pipeline_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
