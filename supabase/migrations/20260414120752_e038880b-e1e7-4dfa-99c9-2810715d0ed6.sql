
-- AI usage control for Phase 2 rate limiting
CREATE TABLE public.ai_usage_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ai_calls_used INTEGER NOT NULL DEFAULT 0,
  ai_calls_limit INTEGER NOT NULL DEFAULT 30,
  plan_type TEXT NOT NULL DEFAULT 'free',
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

ALTER TABLE public.ai_usage_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.ai_usage_control FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.ai_usage_control FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_ai_usage_control_user_period
  ON public.ai_usage_control (user_id, period_start DESC);

CREATE TRIGGER set_ai_usage_control_updated_at
  BEFORE UPDATE ON public.ai_usage_control
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
