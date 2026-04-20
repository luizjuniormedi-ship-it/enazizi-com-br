-- Tabela de penalidades de intervenção (Fase 5)
CREATE TABLE public.intervention_penalties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  intervention_type TEXT NOT NULL,
  penalty_level INTEGER NOT NULL DEFAULT 0,
  penalty_until TIMESTAMP WITH TIME ZONE,
  last_interaction_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT intervention_penalties_user_type_unique UNIQUE (user_id, intervention_type),
  CONSTRAINT intervention_penalties_level_chk CHECK (penalty_level BETWEEN 0 AND 3)
);

CREATE INDEX idx_intervention_penalties_user_type
  ON public.intervention_penalties (user_id, intervention_type);

CREATE INDEX idx_intervention_penalties_until
  ON public.intervention_penalties (penalty_until)
  WHERE penalty_until IS NOT NULL;

ALTER TABLE public.intervention_penalties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own penalties"
  ON public.intervention_penalties
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own penalties"
  ON public.intervention_penalties
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own penalties"
  ON public.intervention_penalties
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own penalties"
  ON public.intervention_penalties
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all penalties"
  ON public.intervention_penalties
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER intervention_penalties_set_updated_at
  BEFORE UPDATE ON public.intervention_penalties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();