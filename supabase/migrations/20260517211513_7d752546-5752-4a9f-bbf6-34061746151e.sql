-- Add columns to drive_ingestion_log
ALTER TABLE public.drive_ingestion_log 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_drive_ingestion_status ON public.drive_ingestion_log(status);
CREATE INDEX IF NOT EXISTS idx_drive_ingestion_file_id ON public.drive_ingestion_log(file_id);
