-- 1) Expandir o CHECK para incluir 'skipped'
ALTER TABLE public.questions_bank
  DROP CONSTRAINT IF EXISTS questions_bank_classification_method_check;

ALTER TABLE public.questions_bank
  ADD CONSTRAINT questions_bank_classification_method_check
  CHECK (
    classification_method IS NULL
    OR classification_method = ANY (ARRAY[
      'exact_text'::text,
      'heuristic'::text,
      'ai'::text,
      'manual'::text,
      'alias_exact'::text,
      'skipped'::text
    ])
  );

-- 2) Adicionar coluna de motivo (nullable)
ALTER TABLE public.questions_bank
  ADD COLUMN IF NOT EXISTS classification_reason text;

ALTER TABLE public.questions_bank
  DROP CONSTRAINT IF EXISTS questions_bank_classification_reason_check;

ALTER TABLE public.questions_bank
  ADD CONSTRAINT questions_bank_classification_reason_check
  CHECK (
    classification_reason IS NULL
    OR classification_reason = ANY (ARRAY[
      'no_specialty_match'::text,
      'low_confidence'::text,
      'no_topic'::text,
      'curriculum_gap'::text
    ])
  );

-- 3) Índice parcial para a fila de curadoria
CREATE INDEX IF NOT EXISTS idx_questions_bank_skipped_reason
  ON public.questions_bank (classification_reason)
  WHERE classification_method = 'skipped';