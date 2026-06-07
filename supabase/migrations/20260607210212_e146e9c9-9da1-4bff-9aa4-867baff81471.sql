ALTER TABLE public.question_classification_staging 
DROP CONSTRAINT IF EXISTS question_classification_staging_classification_status_check;

ALTER TABLE public.question_classification_staging 
ADD CONSTRAINT question_classification_staging_classification_status_check 
CHECK (classification_status = ANY (ARRAY[
    'auto_approved_pending_sample', 
    'sample_review_required', 
    'manual_review_required', 
    'pending',
    'approved',
    'blocked'
]));
