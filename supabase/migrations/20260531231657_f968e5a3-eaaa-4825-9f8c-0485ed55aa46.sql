ALTER TABLE public.questions_bank
  DROP CONSTRAINT IF EXISTS questions_bank_classification_method_check;

ALTER TABLE public.questions_bank
  ADD CONSTRAINT questions_bank_classification_method_check
  CHECK (
    classification_method IS NULL
    OR classification_method IN ('exact_text','heuristic','ai','manual','alias_exact')
  );