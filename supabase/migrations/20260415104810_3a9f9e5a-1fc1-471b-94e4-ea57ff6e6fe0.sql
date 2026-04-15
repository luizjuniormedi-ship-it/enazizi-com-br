
CREATE TABLE public.bulk_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'processing',
  mode TEXT NOT NULL DEFAULT 'equalize',
  specialty TEXT,
  progress JSONB DEFAULT '{}',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

ALTER TABLE public.bulk_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bulk jobs"
ON public.bulk_generation_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_generation_jobs;
