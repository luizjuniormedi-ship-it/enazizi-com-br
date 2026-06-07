-- Tabela para rastrear os lotes de classificação
CREATE TABLE IF NOT EXISTS public.classification_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'processing', -- processing, completed, failed, approved, blocked
    batch_size INTEGER NOT NULL,
    model_used TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    total_cost NUMERIC DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_rate_sample NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    quality_report JSONB DEFAULT '{}'::jsonb
);

-- Adicionar grants para classification_batches
GRANT SELECT, INSERT, UPDATE ON public.classification_batches TO authenticated;
GRANT ALL ON public.classification_batches TO service_role;

-- Refinar question_classification_staging
ALTER TABLE public.question_classification_staging 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.classification_batches(id),
ADD COLUMN IF NOT EXISTS predicted_area TEXT,
ADD COLUMN IF NOT EXISTS reasoning_summary TEXT,
ADD COLUMN IF NOT EXISTS prompt_version TEXT,
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cross_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS validation_divergence TEXT,
ADD COLUMN IF NOT EXISTS batch_index INTEGER; -- Para amostragem determinística se necessário

-- Garantir índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_staging_batch_id ON public.question_classification_staging(batch_id);
CREATE INDEX IF NOT EXISTS idx_staging_status ON public.question_classification_staging(classification_status);
CREATE INDEX IF NOT EXISTS idx_staging_confidence ON public.question_classification_staging(confidence_score);

-- Atualizar RLS
ALTER TABLE public.classification_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage batches" ON public.classification_batches 
FOR ALL USING (auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%admin%')) 
WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%admin%'));

-- Triggers para updated_at (se houver a coluna)
-- (A tabela question_classification_staging já tem updated_at pela migration anterior)
