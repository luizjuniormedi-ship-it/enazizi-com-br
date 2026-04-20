-- Tabela de metas mensais de questões (camada não-destrutiva, complementa daily_plans)
CREATE TABLE IF NOT EXISTS public.study_goal_monthly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  target_questions INT NOT NULL DEFAULT 2000 CHECK (target_questions > 0),
  completed_questions INT NOT NULL DEFAULT 0 CHECK (completed_questions >= 0),
  distribution_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT study_goal_monthly_unique_user_month UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_study_goal_monthly_user
  ON public.study_goal_monthly (user_id, year DESC, month DESC);

ALTER TABLE public.study_goal_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own monthly goals"
  ON public.study_goal_monthly FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own monthly goals"
  ON public.study_goal_monthly FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own monthly goals"
  ON public.study_goal_monthly FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own monthly goals"
  ON public.study_goal_monthly FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_study_goal_monthly_updated_at
  BEFORE UPDATE ON public.study_goal_monthly
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();