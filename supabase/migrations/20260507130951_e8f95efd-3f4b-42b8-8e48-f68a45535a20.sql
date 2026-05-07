-- Tabela de Turmas do Professor
CREATE TABLE public.professor_turmas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Alunos da Turma
CREATE TABLE public.professor_turma_students (
    turma_id UUID NOT NULL REFERENCES public.professor_turmas(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (turma_id, student_id)
);

-- Habilitar RLS
ALTER TABLE public.professor_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_turma_students ENABLE ROW LEVEL SECURITY;

-- Políticas para professor_turmas
CREATE POLICY "Professores podem gerenciar suas turmas"
ON public.professor_turmas
FOR ALL
USING (auth.uid() = (SELECT user_id FROM public.profiles WHERE id = professor_id));

CREATE POLICY "Alunos podem ver turmas que pertencem"
ON public.professor_turmas
FOR SELECT
USING (id IN (SELECT turma_id FROM public.professor_turma_students WHERE student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

-- Políticas para professor_turma_students
CREATE POLICY "Professores podem gerenciar alunos de suas turmas"
ON public.professor_turma_students
FOR ALL
USING (turma_id IN (SELECT id FROM public.professor_turmas WHERE professor_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Alunos podem ver seus próprios vínculos"
ON public.professor_turma_students
FOR SELECT
USING (student_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_professor_turmas_updated_at
BEFORE UPDATE ON public.professor_turmas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
