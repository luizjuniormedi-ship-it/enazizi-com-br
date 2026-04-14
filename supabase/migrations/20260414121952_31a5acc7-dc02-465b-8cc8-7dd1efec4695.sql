
CREATE TABLE public.generated_content_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  theme TEXT NOT NULL,
  subtopic TEXT,
  content_hash TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  source_endpoint TEXT NOT NULL,
  model_used TEXT,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  cost_units INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_content_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content logs"
  ON public.generated_content_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on content logs"
  ON public.generated_content_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_gcl_user_type ON public.generated_content_log (user_id, content_type);
CREATE INDEX idx_gcl_theme ON public.generated_content_log (theme);
CREATE INDEX idx_gcl_created ON public.generated_content_log (created_at DESC);
CREATE INDEX idx_gcl_hash ON public.generated_content_log (content_hash);
CREATE INDEX idx_gcl_user_hash ON public.generated_content_log (user_id, content_hash);
