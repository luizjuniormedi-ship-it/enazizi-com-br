
-- 1. Adicionar task_type a study_plan_items
ALTER TABLE public.study_plan_items 
ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'tutor_lesson';

-- 2. Garantir que os tipos permitidos sejam consistentes (opcional, via comentário para documentação)
COMMENT ON COLUMN public.study_plan_items.task_type IS 'Tipos: tutor_lesson, question_practice, fsrs_review, error_recovery, flashcards, mini_simulado, summary, rest_block';

-- 3. Adicionar coluna de metadados se não existir (para flexibilidade futura)
ALTER TABLE public.study_plan_items
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 4. Índice para performance em filtros por tipo
CREATE INDEX IF NOT EXISTS idx_spi_task_type ON public.study_plan_items (task_type);
