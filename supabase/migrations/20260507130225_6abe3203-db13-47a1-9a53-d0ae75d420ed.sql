-- Add array columns for multiple filters
ALTER TABLE public.teacher_simulados 
ADD COLUMN IF NOT EXISTS faculdade_filters TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS periodo_filters INTEGER[] DEFAULT '{}';

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_teacher_simulados_professor_id ON public.teacher_simulados(professor_id);
CREATE INDEX IF NOT EXISTS idx_teacher_simulado_results_simulado_id ON public.teacher_simulado_results(simulado_id);
CREATE INDEX IF NOT EXISTS idx_teacher_simulado_results_student_id ON public.teacher_simulado_results(student_id);

-- Migration comment to document changes
COMMENT ON COLUMN public.teacher_simulados.faculdade_filters IS 'Array of university filters for student assignment';
COMMENT ON COLUMN public.teacher_simulados.periodo_filters IS 'Array of period filters for student assignment';
