-- 1. Nova especialidade na matriz curricular: Medicina Legal
INSERT INTO public.curriculum_specialties (nome, ciclo, ordem, ativo)
VALUES ('Medicina Legal', 'clinico', 99, true)
ON CONFLICT (nome) DO NOTHING;

-- 2. Expandir vocabulário de classification_reason
ALTER TABLE public.questions_bank
  DROP CONSTRAINT IF EXISTS questions_bank_classification_reason_check;

ALTER TABLE public.questions_bank
  ADD CONSTRAINT questions_bank_classification_reason_check
  CHECK (
    classification_reason IS NULL OR classification_reason = ANY (ARRAY[
      -- legado (mantidos para não quebrar registros antigos)
      'no_specialty_match',
      'low_confidence',
      'no_topic',
      'curriculum_gap',
      -- novos (Sprint Backfill V2)
      'normalized_exact',
      'scope_legal',
      'alias_short',
      'ai_fallback',
      'manual_review',
      'out_of_scope',
      'content_hygiene'
    ])
  );

-- 3. Índice parcial para acelerar a fila de pendentes durante o backfill
CREATE INDEX IF NOT EXISTS idx_qb_pending_classification
  ON public.questions_bank (topic)
  WHERE specialty_id IS NULL
    AND classification_method IS NULL
    AND lifecycle_state IN ('generated','queued_for_enrichment');

-- 4. Índice para auditoria por lifecycle_state não-default
CREATE INDEX IF NOT EXISTS idx_qb_lifecycle_state
  ON public.questions_bank (lifecycle_state)
  WHERE lifecycle_state NOT IN ('generated','queued_for_enrichment');