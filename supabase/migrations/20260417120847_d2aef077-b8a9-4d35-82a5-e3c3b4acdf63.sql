-- F5: orchestrator outcome tracking (auto-tuning preparation)
CREATE TABLE IF NOT EXISTS public.orchestrator_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision_id uuid REFERENCES public.assistant_decisions(id) ON DELETE SET NULL,
  next_action text NOT NULL,
  topic text,
  subtopic text,
  followed boolean,
  outcome text,
  pre_signals jsonb DEFAULT '{}'::jsonb,
  post_signals jsonb DEFAULT '{}'::jsonb,
  improvement_delta numeric,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orch_outcomes_user ON public.orchestrator_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_orch_outcomes_action ON public.orchestrator_outcomes(next_action);
CREATE INDEX IF NOT EXISTS idx_orch_outcomes_decision ON public.orchestrator_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_orch_outcomes_created ON public.orchestrator_outcomes(created_at DESC);

ALTER TABLE public.orchestrator_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orch_outcomes_select_own"
  ON public.orchestrator_outcomes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "orch_outcomes_insert_service"
  ON public.orchestrator_outcomes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "orch_outcomes_admin_all"
  ON public.orchestrator_outcomes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));