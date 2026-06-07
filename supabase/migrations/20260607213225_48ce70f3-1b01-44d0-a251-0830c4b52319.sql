ALTER TABLE public.question_classification_staging ADD COLUMN IF NOT EXISTS wave_id UUID REFERENCES public.promotion_waves(id);
ALTER TABLE public.classification_batches ADD COLUMN IF NOT EXISTS wave_id UUID REFERENCES public.promotion_waves(id);

-- Criar índices para performance nas consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_staging_wave_id ON public.question_classification_staging(wave_id);
CREATE INDEX IF NOT EXISTS idx_batches_wave_id ON public.classification_batches(wave_id);
