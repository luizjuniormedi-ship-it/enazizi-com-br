-- Fase 1: Hardening da tabela de questões (questions_bank é a tabela real)
ALTER TABLE public.questions_bank 
  ADD CONSTRAINT check_options_length CHECK (jsonb_array_length(options) = 4),
  ADD CONSTRAINT check_correct_index_range CHECK (correct_index >= 0 AND correct_index <= 3),
  ALTER COLUMN statement SET NOT NULL,
  ALTER COLUMN explanation SET NOT NULL,
  ALTER COLUMN difficulty SET NOT NULL;

-- Anti-duplicação: Índice único baseado no hash do texto da questão (statement)
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_bank_statement_unique ON public.questions_bank (md5(statement));

-- Tabela de Auditoria Enterprise
CREATE TABLE IF NOT EXISTS public.question_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id UUID REFERENCES public.questions_bank(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'generation', 'validation', 'rejection', 'update'
    status TEXT NOT NULL, -- 'success', 'failed', 'flagged'
    quality_score FLOAT,
    hallucination_score FLOAT,
    ai_metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.question_audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de visualização para admins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'question_audit_logs' AND policyname = 'Admins can view all audit logs'
    ) THEN
        CREATE POLICY "Admins can view all audit logs" 
        ON public.question_audit_logs 
        FOR SELECT 
        USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
    END IF;
END $$;

-- Trigger para updated_at na questions_bank
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_questions_bank_updated_at ON public.questions_bank;
CREATE TRIGGER update_questions_bank_updated_at
    BEFORE UPDATE ON public.questions_bank
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();