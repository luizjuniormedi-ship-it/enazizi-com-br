
-- Create assistant_decisions table for pedagogical decision audit trail
CREATE TABLE public.assistant_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  decision_type TEXT NOT NULL,
  source_module TEXT NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_output JSONB NOT NULL DEFAULT '{}'::jsonb,
  justification TEXT NOT NULL DEFAULT '',
  confidence_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assistant_decisions ENABLE ROW LEVEL SECURITY;

-- User can read own decisions
CREATE POLICY "Users can view own decisions"
  ON public.assistant_decisions FOR SELECT
  USING (auth.uid() = user_id);

-- User can insert own decisions
CREATE POLICY "Users can insert own decisions"
  ON public.assistant_decisions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin can view all
CREATE POLICY "Admins can view all decisions"
  ON public.assistant_decisions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role inserts (edge functions use service role)
CREATE POLICY "Service can manage decisions"
  ON public.assistant_decisions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_assistant_decisions_user_id ON public.assistant_decisions (user_id);
CREATE INDEX idx_assistant_decisions_type ON public.assistant_decisions (decision_type);
CREATE INDEX idx_assistant_decisions_created ON public.assistant_decisions (created_at DESC);
CREATE INDEX idx_assistant_decisions_user_type ON public.assistant_decisions (user_id, decision_type, created_at DESC);

-- Auto-update timestamp
CREATE TRIGGER set_assistant_decisions_updated_at
  BEFORE UPDATE ON public.assistant_decisions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
