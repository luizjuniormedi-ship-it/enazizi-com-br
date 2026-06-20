
-- 1) Expandir CHECK de source
ALTER TABLE public.memory_consolidation_sessions
  DROP CONSTRAINT IF EXISTS memory_consolidation_sessions_source_check;

ALTER TABLE public.memory_consolidation_sessions
  ADD CONSTRAINT memory_consolidation_sessions_source_check
  CHECK (source IN (
    'tutor_v3','error_review','fsrs_due','manual',
    'question','simulado','flashcard','mission'
  ));

-- 2) Unique determinístico em métricas quando topic_id é NULL
ALTER TABLE public.memory_consolidation_metrics
  DROP CONSTRAINT IF EXISTS memory_consolidation_metrics_user_id_topic_id_window_label_key;

-- Caso topic_id NÃO seja nulo: chave (user_id, topic_id, window_label)
CREATE UNIQUE INDEX IF NOT EXISTS mcm_unique_with_topic
  ON public.memory_consolidation_metrics (user_id, topic_id, window_label)
  WHERE topic_id IS NOT NULL;

-- Caso topic_id seja nulo: usa topic_label como chave (coalesce para string vazia)
CREATE UNIQUE INDEX IF NOT EXISTS mcm_unique_without_topic
  ON public.memory_consolidation_metrics (user_id, COALESCE(topic_label, ''), window_label)
  WHERE topic_id IS NULL;
