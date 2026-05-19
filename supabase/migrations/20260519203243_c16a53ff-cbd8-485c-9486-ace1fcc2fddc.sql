
-- 1. Expandir cognitive_analytics
ALTER TABLE public.cognitive_analytics
  ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collapse_risk numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS abandonment_risk numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS learning_velocity numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mastery_index numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consistency_index numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS projected_retention_14d numeric DEFAULT 0;

-- 2. Trajectory Health Scores (master metric)
CREATE TABLE IF NOT EXISTS public.trajectory_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  health_score numeric NOT NULL DEFAULT 0,
  classification text NOT NULL DEFAULT 'stable',
  delay_score numeric DEFAULT 0,
  retention_score numeric DEFAULT 0,
  consistency_score numeric DEFAULT 0,
  execution_score numeric DEFAULT 0,
  fatigue_score numeric DEFAULT 0,
  recovery_score numeric DEFAULT 0,
  simulado_score numeric DEFAULT 0,
  longitudinal_risk numeric DEFAULT 0,
  exam_proximity_days integer,
  pre_exam_mode boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trajectory_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_trajectory_health"
  ON public.trajectory_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins_view_all_trajectory_health"
  ON public.trajectory_health_scores FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_trajectory_health_user_date
  ON public.trajectory_health_scores (user_id, created_at DESC);

-- 3. Predictive Recovery Forecasts
CREATE TABLE IF NOT EXISTS public.predictive_recovery_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  forecast_type text NOT NULL,
  target_topic text,
  target_specialty text,
  predicted_failure_date timestamptz,
  risk_score numeric DEFAULT 0,
  confidence numeric DEFAULT 0,
  recommended_action text,
  payload jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.predictive_recovery_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_forecasts"
  ON public.predictive_recovery_forecasts FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recovery_forecasts_user
  ON public.predictive_recovery_forecasts (user_id, created_at DESC);
