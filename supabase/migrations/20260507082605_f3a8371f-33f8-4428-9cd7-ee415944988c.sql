-- Create table for manual questions
CREATE TABLE IF NOT EXISTS public.teacher_simulado_questions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    simulado_id UUID NOT NULL REFERENCES public.teacher_simulados(id) ON DELETE CASCADE,
    statement TEXT NOT NULL,
    options TEXT[] NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT,
    topic TEXT,
    difficulty_level TEXT DEFAULT 'intermediario',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_simulado_questions ENABLE ROW LEVEL SECURITY;

-- Policies for teacher_simulado_questions
CREATE POLICY "Professors can view questions of their own simulados"
ON public.teacher_simulado_questions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.teacher_simulados
        WHERE public.teacher_simulados.id = public.teacher_simulado_questions.simulado_id
        AND public.teacher_simulados.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can insert questions into their own simulados"
ON public.teacher_simulado_questions
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.teacher_simulados
        WHERE public.teacher_simulados.id = public.teacher_simulado_questions.simulado_id
        AND public.teacher_simulados.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can update questions of their own simulados"
ON public.teacher_simulado_questions
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.teacher_simulados
        WHERE public.teacher_simulados.id = public.teacher_simulado_questions.simulado_id
        AND public.teacher_simulados.professor_id = auth.uid()
    )
);

CREATE POLICY "Professors can delete questions from their own simulados"
ON public.teacher_simulado_questions
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.teacher_simulados
        WHERE public.teacher_simulados.id = public.teacher_simulado_questions.simulado_id
        AND public.teacher_simulados.professor_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_teacher_simulado_questions_updated_at
BEFORE UPDATE ON public.teacher_simulado_questions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
