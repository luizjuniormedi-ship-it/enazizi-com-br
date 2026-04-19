
CREATE TABLE IF NOT EXISTS public.tutor_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID NULL,
  event_type TEXT NOT NULL,
  topic TEXT NULL,
  subtopic TEXT NULL,
  block_type TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT NULL,
  related_message_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_events_user_created
  ON public.tutor_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tutor_events_user_type
  ON public.tutor_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_tutor_events_topic
  ON public.tutor_events (user_id, topic) WHERE topic IS NOT NULL;

ALTER TABLE public.tutor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tutor events" ON public.tutor_events;
DROP POLICY IF EXISTS "Users can insert their own tutor events" ON public.tutor_events;
DROP POLICY IF EXISTS "Admins can view all tutor events" ON public.tutor_events;

CREATE POLICY "Users can view their own tutor events"
  ON public.tutor_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tutor events"
  ON public.tutor_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tutor events"
  ON public.tutor_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.system_flags (flag_key, enabled, description, category, rollout_mode)
VALUES
  ('tutor_v2_enabled', false,
   'Master switch: habilita arquitetura V2 do Tutor IA (hooks especializados + blocos)',
   'tutor', 'admins_only'),
  ('tutor_blocks_enabled', false,
   'Habilita protocolo de blocos pedagógicos estruturados (substitui markdown puro)',
   'tutor', 'admins_only'),
  ('tutor_adaptive_context_enabled', false,
   'Habilita injeção de contexto adaptativo (FSRS, erros, missão, prep_index) no Tutor',
   'tutor', 'admins_only'),
  ('tutor_adaptive_writeback_enabled', false,
   'Habilita escrita do Tutor no cérebro adaptativo (mini-quiz → error_bank/FSRS)',
   'tutor', 'admins_only')
ON CONFLICT (flag_key) DO NOTHING;
