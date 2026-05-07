CREATE TABLE IF NOT EXISTS public.teacher_simulado_trace_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  teacher_id UUID NOT NULL REFERENCES auth.users(id),
  step_name TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  error_message TEXT,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.teacher_simulado_trace_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Professors can view their own trace logs"
ON public.teacher_simulado_trace_logs
FOR SELECT
USING (auth.uid() = teacher_id);

CREATE POLICY "Admins can view all trace logs"
ON public.teacher_simulado_trace_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
));

CREATE INDEX idx_teacher_simulado_trace_logs_trace_id ON public.teacher_simulado_trace_logs(trace_id);
CREATE INDEX idx_teacher_simulado_trace_logs_teacher_id ON public.teacher_simulado_trace_logs(teacher_id);