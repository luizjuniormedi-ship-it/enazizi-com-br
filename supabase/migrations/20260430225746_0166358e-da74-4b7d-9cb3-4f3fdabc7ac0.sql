-- FASE 1: Biblioteca de Videoaulas IA Adaptativa (aditivo)
ALTER TABLE public.lesson_segments
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS key_points jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS segment_type text DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS has_quiz boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_flashcards boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS difficulty_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_lesson_segments_lesson_time
  ON public.lesson_segments(lesson_id, start_second);

-- video_segment_events
CREATE TABLE IF NOT EXISTS public.video_segment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_lesson_id uuid NOT NULL,
  segment_id uuid,
  event_type text NOT NULL,
  timestamp_seconds integer,
  duration_ms integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vse_user_lesson ON public.video_segment_events(user_id, video_lesson_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vse_segment ON public.video_segment_events(segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vse_event_type ON public.video_segment_events(event_type, created_at DESC);
ALTER TABLE public.video_segment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vse_select_own" ON public.video_segment_events;
CREATE POLICY "vse_select_own" ON public.video_segment_events
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "vse_insert_own" ON public.video_segment_events;
CREATE POLICY "vse_insert_own" ON public.video_segment_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- video_segment_fsrs
CREATE TABLE IF NOT EXISTS public.video_segment_fsrs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_lesson_id uuid NOT NULL,
  segment_id uuid NOT NULL,
  topic text,
  subtopic text,
  difficulty numeric DEFAULT 5.0,
  stability numeric DEFAULT 1.0,
  retrievability numeric DEFAULT 0.9,
  due_at timestamptz NOT NULL DEFAULT now(),
  reps integer DEFAULT 0,
  lapses integer DEFAULT 0,
  last_review timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, segment_id)
);
CREATE INDEX IF NOT EXISTS idx_vsfsrs_user_due ON public.video_segment_fsrs(user_id, due_at);
ALTER TABLE public.video_segment_fsrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vsfsrs_select_own" ON public.video_segment_fsrs;
CREATE POLICY "vsfsrs_select_own" ON public.video_segment_fsrs
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "vsfsrs_insert_own" ON public.video_segment_fsrs;
CREATE POLICY "vsfsrs_insert_own" ON public.video_segment_fsrs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "vsfsrs_update_own" ON public.video_segment_fsrs;
CREATE POLICY "vsfsrs_update_own" ON public.video_segment_fsrs
  FOR UPDATE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_vsfsrs_updated_at ON public.video_segment_fsrs;
CREATE TRIGGER trg_vsfsrs_updated_at BEFORE UPDATE ON public.video_segment_fsrs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- video_adaptive_recommendations
CREATE TABLE IF NOT EXISTS public.video_adaptive_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_lesson_id uuid,
  segment_id uuid,
  recommendation_type text NOT NULL,
  priority numeric DEFAULT 50,
  reason text,
  payload jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_var_user_status ON public.video_adaptive_recommendations(user_id, status, priority DESC);
ALTER TABLE public.video_adaptive_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "var_select_own" ON public.video_adaptive_recommendations;
CREATE POLICY "var_select_own" ON public.video_adaptive_recommendations
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "var_insert_own" ON public.video_adaptive_recommendations;
CREATE POLICY "var_insert_own" ON public.video_adaptive_recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "var_update_own" ON public.video_adaptive_recommendations;
CREATE POLICY "var_update_own" ON public.video_adaptive_recommendations
  FOR UPDATE USING (auth.uid() = user_id);

-- Feature flags (rollout admins_only)
INSERT INTO public.system_flags (flag_key, enabled, description, category, rollout_mode)
VALUES
  ('adaptive_video_enabled', false, 'Engine adaptativa de recomendação multimídia (vídeo/áudio/quiz/flashcard/tutor).', 'video', 'admins_only'),
  ('smart_replay_enabled', false, 'Detecta replay/abandono/pausas excessivas e sugere revisão contextual.', 'video', 'admins_only'),
  ('tutor_temporal_enabled', false, 'Tutor IA sincronizado com timestamps do vídeo e segmentos.', 'video', 'admins_only'),
  ('multimodal_analytics_enabled', false, 'Coleta e exibe analytics multimodais por segmento.', 'video', 'admins_only')
ON CONFLICT (flag_key) DO NOTHING;