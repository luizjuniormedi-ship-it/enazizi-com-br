CREATE TABLE IF NOT EXISTS public.orchestrator_rule_weights (
  rule_id text PRIMARY KEY,
  rule_name text NOT NULL,
  current_weight numeric NOT NULL DEFAULT 1.0,
  baseline_weight numeric NOT NULL DEFAULT 1.0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  last_adjusted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orchestrator_rule_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rule_weights_read_authenticated" ON public.orchestrator_rule_weights;
CREATE POLICY "rule_weights_read_authenticated"
  ON public.orchestrator_rule_weights
  FOR SELECT
  TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_rule_weights_updated_at ON public.orchestrator_rule_weights;
CREATE TRIGGER trg_rule_weights_updated_at
  BEFORE UPDATE ON public.orchestrator_rule_weights
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.orchestrator_rule_weights (rule_id, rule_name, current_weight, baseline_weight) VALUES
  ('R1', 'FSRS overdue threshold', 1.0, 1.0),
  ('R2', 'Repeated error topics', 1.0, 1.0),
  ('R3', 'Conceptual error triggers tutor', 1.0, 1.0),
  ('R4', 'Memorization gap triggers mnemonic', 1.0, 1.0),
  ('R5', 'Visual accuracy weakness', 1.0, 1.0),
  ('R6', 'Stable base unlocks simulado', 1.0, 1.0),
  ('R7', 'Default guided study session', 1.0, 1.0),
  ('R8', 'Daily plan missing', 1.0, 1.0)
ON CONFLICT (rule_id) DO NOTHING;