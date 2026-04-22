BEGIN;
DROP INDEX IF EXISTS public.uniq_pending_queue_per_question;
ALTER TABLE public.question_classification_queue
  ADD CONSTRAINT uniq_queue_table_question
  UNIQUE (table_source, question_id);
COMMIT;