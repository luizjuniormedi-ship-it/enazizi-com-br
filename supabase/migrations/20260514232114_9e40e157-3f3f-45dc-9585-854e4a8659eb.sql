ALTER TABLE public.official_exam_files ADD CONSTRAINT official_exam_files_file_url_key UNIQUE (file_url);

-- Update status check to include 'discovered'
ALTER TABLE public.official_exam_files DROP CONSTRAINT official_exam_files_status_check;
ALTER TABLE public.official_exam_files ADD CONSTRAINT official_exam_files_status_check 
CHECK (status = ANY (ARRAY['discovered'::text, 'pending'::text, 'downloaded'::text, 'processed'::text, 'error'::text, 'extracted'::text]));
