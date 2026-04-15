-- Gap fill execution logs
CREATE TABLE IF NOT EXISTS public.gap_fill_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_type text NOT NULL,
  gaps_detected integer DEFAULT 0,
  gaps_planned integer DEFAULT 0,
  diagnoses_processed text[] DEFAULT '{}',
  assets_created integer DEFAULT 0,
  questions_generated integer DEFAULT 0,
  errors integer DEFAULT 0,
  error_details text[] DEFAULT '{}',
  execution_time_ms integer DEFAULT 0,
  status text DEFAULT 'running',
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.gap_fill_logs ENABLE ROW LEVEL SECURITY;

-- No public access - only service role
CREATE POLICY "Service role only on gap_fill_logs"
ON public.gap_fill_logs FOR ALL
USING (false);

-- Gap fill state (singleton for coordination)
CREATE TABLE IF NOT EXISTS public.gap_fill_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_run_at timestamptz,
  is_running boolean DEFAULT false,
  current_image_type text,
  total_runs integer DEFAULT 0,
  total_gaps_filled integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.gap_fill_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on gap_fill_state"
ON public.gap_fill_state FOR ALL
USING (false);

-- Insert singleton row
INSERT INTO public.gap_fill_state (id) VALUES (1) ON CONFLICT DO NOTHING;