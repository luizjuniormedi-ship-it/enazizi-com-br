-- questions_bank: drop both versions and recreate with full list
ALTER TABLE public.questions_bank
  DROP CONSTRAINT IF EXISTS questions_bank_classification_method_check;
ALTER TABLE public.questions_bank
  ADD CONSTRAINT questions_bank_classification_method_check
  CHECK (
    classification_method IS NULL
    OR classification_method = ANY (ARRAY[
      'exact_text','heuristic','ai','manual','alias_exact','skipped'
    ])
  );

-- real_exam_questions: idem
ALTER TABLE public.real_exam_questions
  DROP CONSTRAINT IF EXISTS real_exam_questions_classification_method_check;
ALTER TABLE public.real_exam_questions
  ADD CONSTRAINT real_exam_questions_classification_method_check
  CHECK (
    classification_method IS NULL
    OR classification_method = ANY (ARRAY[
      'exact_text','heuristic','ai','manual','alias_exact','skipped'
    ])
  );

-- question_classification_queue: idem (sem NULL — sempre tem método)
ALTER TABLE public.question_classification_queue
  DROP CONSTRAINT IF EXISTS question_classification_queue_classification_method_check;
ALTER TABLE public.question_classification_queue
  ADD CONSTRAINT question_classification_queue_classification_method_check
  CHECK (
    classification_method = ANY (ARRAY[
      'exact_text','heuristic','ai','manual','alias_exact','skipped'
    ])
  );