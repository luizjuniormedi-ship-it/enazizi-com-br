-- Evolução da tabela teacher_simulados
ALTER TABLE public.teacher_simulados 
ADD COLUMN IF NOT EXISTS start_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS feedback_policy TEXT DEFAULT 'immediate', -- 'immediate', 'after_deadline', 'manual'
ADD COLUMN IF NOT EXISTS allow_retake BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exam_board TEXT;

-- Tabela de atribuições
CREATE TABLE IF NOT EXISTS public.teacher_simulado_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    simulado_id UUID REFERENCES public.teacher_simulados(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'class', 'student', 'all'
    target_id UUID, -- id da turma ou id do aluno
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Fila de notificações
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'simulado_published', 'grade_released', etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    priority INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.teacher_simulado_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para atribuições
CREATE POLICY "Professores podem gerenciar suas atribuições" 
ON public.teacher_simulado_assignments 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.teacher_simulados s 
        WHERE s.id = teacher_simulado_assignments.simulado_id 
        AND s.professor_id = auth.uid()
    )
);

CREATE POLICY "Alunos podem ver suas atribuições" 
ON public.teacher_simulado_assignments 
FOR SELECT 
USING (
    (target_type = 'student' AND target_id = auth.uid()) OR
    (target_type = 'class' AND EXISTS (
        SELECT 1 FROM public.class_members cm 
        WHERE cm.class_id = teacher_simulado_assignments.target_id 
        AND cm.user_id = auth.uid()
    )) OR
    (target_type = 'all')
);

-- Políticas para notificações
CREATE POLICY "Usuários podem ver suas próprias notificações" 
ON public.notification_queue 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Sistema pode gerenciar notificações" 
ON public.notification_queue 
FOR ALL 
USING (auth.uid() IS NOT NULL); -- Em produção, restringir a service_role se possível, mas para app mobile/web, o professor cria.

-- Trigger para atualizar updated_at se houver a função
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_teacher_simulados_updated_at
        BEFORE UPDATE ON public.teacher_simulados
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
