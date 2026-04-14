
CREATE TABLE public.automation_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  module text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_telemetry_type ON public.automation_telemetry (event_type);
CREATE INDEX idx_automation_telemetry_user ON public.automation_telemetry (user_id);
CREATE INDEX idx_automation_telemetry_created ON public.automation_telemetry (created_at DESC);

ALTER TABLE public.automation_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own telemetry"
  ON public.automation_telemetry FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert telemetry"
  ON public.automation_telemetry FOR INSERT
  WITH CHECK (true);
