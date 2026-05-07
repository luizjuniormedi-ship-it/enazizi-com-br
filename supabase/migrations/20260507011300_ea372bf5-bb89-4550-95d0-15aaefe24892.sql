-- Atualizar campos de controle na tabela principal de simulados do professor
ALTER TABLE public.teacher_simulados
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Garantir que o campo status tenha os valores corretos via check constraint (se necessário)
-- Nota: O campo status já existe, mas vamos garantir a lógica de ciclo de vida no código.

-- Criar tabela para submissões individuais (respostas detalhadas e correção)
CREATE TABLE IF NOT EXISTS public.teacher_simulado_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id UUID REFERENCES public.teacher_simulados(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}', -- Mapa de índice_questão -> índice_resposta
  score FLOAT DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('started', 'submitted', 'graded')),
  professor_comment TEXT,
  ai_recommendations JSONB DEFAULT '[]', -- Sugestões do Tutor IA
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(simulado_id, student_id) -- Um aluno só pode ter uma submissão ativa por simulado (dependendo da política de retake)
);

-- Ativar RLS
ALTER TABLE public.teacher_simulado_submissions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Professores visualizam submissões de seus simulados"
ON public.teacher_simulado_submissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_simulados s
    WHERE s.id = teacher_simulado_submissions.simulado_id
    AND s.professor_id = auth.uid()
  )
);

CREATE POLICY "Alunos visualizam seu próprio resultado"
ON public.teacher_simulado_submissions
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Alunos iniciam/enviam simulado"
ON public.teacher_simulado_submissions
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Professores corrigem e comentam submissões"
ON public.teacher_simulado_submissions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_simulados s
    WHERE s.id = teacher_simulado_submissions.simulado_id
    AND s.professor_id = auth.uid()
  )
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_teacher_simulado_submissions_updated_at
BEFORE UPDATE ON public.teacher_simulado_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
