-- FASE 6 — Personalização por Perfil do Aluno
CREATE TABLE public.intervention_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  intervention_type text NOT NULL,
  shown_count int NOT NULL DEFAULT 0,
  clicked_count int NOT NULL DEFAULT 0,
  resolved_count int NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  conversion_rate numeric NOT NULL DEFAULT 0,
  profile_score numeric NOT NULL DEFAULT 0,
  last_event_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intervention_user_profiles_unique UNIQUE (user_id, intervention_type),
  CONSTRAINT intervention_user_profiles_counts_nonneg CHECK (
    shown_count >= 0 AND clicked_count >= 0 AND resolved_count >= 0
  ),
  CONSTRAINT intervention_user_profiles_rates_range CHECK (
    ctr >= 0 AND ctr <= 1
    AND conversion_rate >= 0 AND conversion_rate <= 1
    AND profile_score >= 0 AND profile_score <= 1
  )
);

CREATE INDEX idx_intervention_user_profiles_user_type
  ON public.intervention_user_profiles (user_id, intervention_type);

CREATE INDEX idx_intervention_user_profiles_user_score
  ON public.intervention_user_profiles (user_id, profile_score DESC);

-- Trigger updated_at
CREATE TRIGGER trg_intervention_user_profiles_updated_at
BEFORE UPDATE ON public.intervention_user_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.intervention_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own intervention profiles"
ON public.intervention_user_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all intervention profiles"
ON public.intervention_user_profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert their own intervention profiles"
ON public.intervention_user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own intervention profiles"
ON public.intervention_user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);