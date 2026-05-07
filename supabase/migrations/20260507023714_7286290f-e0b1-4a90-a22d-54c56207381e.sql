-- 1. Enums e Tipos
DO $$ BEGIN
    CREATE TYPE simulado_status AS ENUM ('draft', 'scheduled', 'published', 'in_progress', 'closed', 'corrected', 'archived', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM ('in_app', 'email');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Atualizar teacher_simulados com campos adicionais (status já existe como TEXT, vamos tentar converter ou usar como está)
-- Se status já for TEXT, o enum pode dar conflito se já houver dados. Vamos manter como TEXT por segurança se já existir.
ALTER TABLE public.teacher_simulados 
ADD COLUMN IF NOT EXISTS answer_key_policy TEXT DEFAULT 'after_submission'; -- 'after_submission', 'after_closed', 'manual'

-- 3. Tabela de Avaliações por Aluno
CREATE TABLE IF NOT EXISTS public.teacher_simulado_student_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulado_id UUID REFERENCES public.teacher_simulados(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    professor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    score DECIMAL(5,2),
    accuracy DECIMAL(5,2),
    time_spent_seconds INTEGER,
    weak_topics JSONB DEFAULT '[]'::jsonb,
    wrong_questions JSONB DEFAULT '[]'::jsonb,
    professor_comment TEXT,
    tutor_recommendation TEXT,
    intervention_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabela de Intervenções Pedagógicas
CREATE TABLE IF NOT EXISTS public.teacher_simulado_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID REFERENCES public.teacher_simulado_student_reviews(id) ON DELETE CASCADE,
    student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT, -- 'reforço', 'missao_tutor', 'banco_erros'
    content JSONB,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Histórico de Status
CREATE TABLE IF NOT EXISTS public.teacher_simulado_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulado_id UUID REFERENCES public.teacher_simulados(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT,
    changed_by UUID REFERENCES auth.users(id),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Fila de Notificações
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    channel notification_channel DEFAULT 'in_app',
    type TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'pending_provider'
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Configurar RLS (Row Level Security)
ALTER TABLE public.teacher_simulado_student_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_simulado_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_simulado_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- Policies para Reviews
CREATE POLICY "Professores veem reviews de seus simulados" ON public.teacher_simulado_student_reviews
    FOR ALL USING (auth.uid() = professor_id OR EXISTS (SELECT 1 FROM public.teacher_simulados WHERE id = simulado_id AND professor_id = auth.uid()));

CREATE POLICY "Alunos veem seus próprios reviews" ON public.teacher_simulado_student_reviews
    FOR SELECT USING (auth.uid() = student_id);

-- Policies para Intervenções
CREATE POLICY "Professores gerenciam intervenções" ON public.teacher_simulado_interventions
    FOR ALL USING (EXISTS (SELECT 1 FROM public.teacher_simulado_student_reviews r WHERE r.id = review_id AND r.professor_id = auth.uid()));

CREATE POLICY "Alunos veem suas intervenções" ON public.teacher_simulado_interventions
    FOR SELECT USING (auth.uid() = student_id);

-- Policies para Notificações
CREATE POLICY "Usuários veem suas notificações" ON public.notification_queue
    FOR SELECT USING (auth.uid() = user_id);

-- 8. Funções e Triggers
CREATE OR REPLACE FUNCTION public.handle_simulado_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.teacher_simulado_status_history (simulado_id, old_status, new_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
        
        -- Notificar alunos se publicado
        IF NEW.status = 'published' THEN
            INSERT INTO public.notification_queue (user_id, type, title, message, metadata)
            SELECT student_id, 'simulado_published', 'Novo Simulado Disponível', 'O simulado ' || NEW.title || ' foi publicado.', jsonb_build_object('simulado_id', NEW.id)
            FROM public.teacher_simulado_assignments
            WHERE simulado_id = NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_simulado_status_change
    AFTER UPDATE ON public.teacher_simulados
    FOR EACH ROW EXECUTE FUNCTION public.handle_simulado_status_change();