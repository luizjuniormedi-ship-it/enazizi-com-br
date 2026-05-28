CREATE TABLE IF NOT EXISTS public.backup_questions_bank_classification_20260527 AS
SELECT id, topic, subtopic, specialty_id, approved_for_generation, updated_at
FROM public.questions_bank;

GRANT ALL ON public.backup_questions_bank_classification_20260527 TO service_role;

ALTER TABLE public.backup_questions_bank_classification_20260527 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup classification admin only"
ON public.backup_questions_bank_classification_20260527
FOR ALL
USING (false)
WITH CHECK (false);