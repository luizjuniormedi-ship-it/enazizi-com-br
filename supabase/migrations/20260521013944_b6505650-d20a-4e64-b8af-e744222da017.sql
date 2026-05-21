
-- 1. Idempotência da memória pedagógica longitudinal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'tutor_knowledge_memory_unique_normalized'
  ) THEN
    CREATE UNIQUE INDEX tutor_knowledge_memory_unique_normalized
      ON public.tutor_knowledge_memory (
        scope,
        COALESCE(user_id::text, 'global'),
        question_normalized
      );
  END IF;
END $$;

-- 2. Índice de recuperação longitudinal por usuário + tema
CREATE INDEX IF NOT EXISTS idx_tutor_lesson_memory_user_topic_updated
  ON public.tutor_lesson_memory (user_id, topic, updated_at DESC);

-- 3. Telemetria enterprise do runtime do tutor
CREATE TABLE IF NOT EXISTS public.tutor_runtime_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  correlation_id UUID,
  function_name TEXT,
  tutor_generation_ms INTEGER DEFAULT 0,
  memory_hit BOOLEAN DEFAULT FALSE,
  memory_lookup_ms INTEGER DEFAULT 0,
  persistence_ms INTEGER DEFAULT 0,
  duplicate_key_recovered BOOLEAN DEFAULT FALSE,
  streaming_truncated BOOLEAN DEFAULT FALSE,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  model_used TEXT,
  topic TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_runtime_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tutor_runtime_metrics' AND policyname = 'Users view own runtime metrics'
  ) THEN
    CREATE POLICY "Users view own runtime metrics"
      ON public.tutor_runtime_metrics FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tutor_runtime_metrics' AND policyname = 'Service role manages runtime metrics'
  ) THEN
    CREATE POLICY "Service role manages runtime metrics"
      ON public.tutor_runtime_metrics FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tutor_runtime_metrics_user_created
  ON public.tutor_runtime_metrics (user_id, created_at DESC);

-- 4. Índice de recuperação rápida de sessão pedagógica
CREATE INDEX IF NOT EXISTS idx_pedagogical_sessions_user_topic
  ON public.pedagogical_sessions (user_id, topic, updated_at DESC);
