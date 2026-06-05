-- Normalização de quality_tier
UPDATE public.questions_bank 
SET quality_tier = 'gold' 
WHERE quality_tier IN ('GOLD', 'GOLDEN');

-- Normalização de REJECTED para minúsculo caso exista padrão
UPDATE public.questions_bank 
SET quality_tier = 'rejected' 
WHERE quality_tier = 'REJECTED';

-- Documentação de Backfill pendente
COMMENT ON COLUMN public.flashcards.source_map_id IS 'Pendente: Backfill de 27.923 registros sem mapeamento de origem.';
COMMENT ON COLUMN public.questions_bank.source_map_id IS 'Pendente: Backfill de 18.723 registros sem mapeamento de origem.';
