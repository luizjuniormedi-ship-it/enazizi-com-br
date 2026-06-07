ALTER TABLE public.topic_generation_logs ADD COLUMN IF NOT EXISTS simulado_id UUID REFERENCES public.simulado_sessions(id);
CREATE INDEX IF NOT EXISTS idx_topic_gen_logs_simulado_id ON public.topic_generation_logs(simulado_id);
