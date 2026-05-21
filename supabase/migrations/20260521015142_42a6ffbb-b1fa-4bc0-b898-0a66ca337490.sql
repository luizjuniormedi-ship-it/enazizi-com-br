CREATE INDEX IF NOT EXISTS idx_tutor_runtime_metrics_created_at ON public.tutor_runtime_metrics (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedagogical_sessions_conv_id ON public.pedagogical_sessions (conversation_id);
CREATE INDEX IF NOT EXISTS idx_tutor_memory_topic_subtopic ON public.tutor_knowledge_memory (topic, subtopic) WHERE scope = 'global';
