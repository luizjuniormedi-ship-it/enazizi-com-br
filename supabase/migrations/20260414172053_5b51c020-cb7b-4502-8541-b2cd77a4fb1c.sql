
-- Study Loop Events: granular tracking of every loop interaction
CREATE TABLE public.study_loop_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  event_type TEXT NOT NULL, -- loop_start, loop_complete, loop_abandon, answer_correct, answer_wrong, quick_action, error, reinforcement, elegant_exit
  recommendation_type TEXT, -- review, error_review, daily_task, free_study
  theme TEXT,
  subtopic TEXT,
  target_id TEXT,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sle_user_created ON public.study_loop_events(user_id, created_at DESC);
CREATE INDEX idx_sle_event_type ON public.study_loop_events(event_type, created_at DESC);

ALTER TABLE public.study_loop_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own loop events"
  ON public.study_loop_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own loop events"
  ON public.study_loop_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all loop events"
  ON public.study_loop_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User Engagement Daily: aggregated daily metrics per user
CREATE TABLE public.user_engagement_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  loops_started INTEGER DEFAULT 0,
  loops_completed INTEGER DEFAULT 0,
  loops_abandoned INTEGER DEFAULT 0,
  questions_answered INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  quick_actions_used INTEGER DEFAULT 0,
  total_study_seconds INTEGER DEFAULT 0,
  reinforcements_triggered INTEGER DEFAULT 0,
  elegant_exits INTEGER DEFAULT 0,
  errors_encountered INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, metric_date)
);

CREATE INDEX idx_ued_date ON public.user_engagement_daily(metric_date DESC);
CREATE INDEX idx_ued_user ON public.user_engagement_daily(user_id, metric_date DESC);

ALTER TABLE public.user_engagement_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upsert own daily engagement"
  ON public.user_engagement_daily FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily engagement"
  ON public.user_engagement_daily FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own daily engagement"
  ON public.user_engagement_daily FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all daily engagement"
  ON public.user_engagement_daily FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
