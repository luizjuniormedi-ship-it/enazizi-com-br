
CREATE TABLE IF NOT EXISTS public.ai_runtime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id uuid,
  request_id text,
  task_type text NOT NULL,
  specialty text,
  topic text,
  provider text,
  model text,
  prompt_profile text,
  fallback_used boolean NOT NULL DEFAULT false,
  fallback_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric,
  quality_score numeric,
  error_code text,
  success boolean NOT NULL DEFAULT false,
  budget_mode text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_runtime_logs_user_created
  ON public.ai_runtime_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runtime_logs_session_created
  ON public.ai_runtime_logs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runtime_logs_task_created
  ON public.ai_runtime_logs (task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runtime_logs_success
  ON public.ai_runtime_logs (success, created_at DESC);

ALTER TABLE public.ai_runtime_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own AI runtime logs"
  ON public.ai_runtime_logs;
CREATE POLICY "Users can view their own AI runtime logs"
  ON public.ai_runtime_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all AI runtime logs"
  ON public.ai_runtime_logs;
CREATE POLICY "Admins can view all AI runtime logs"
  ON public.ai_runtime_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
