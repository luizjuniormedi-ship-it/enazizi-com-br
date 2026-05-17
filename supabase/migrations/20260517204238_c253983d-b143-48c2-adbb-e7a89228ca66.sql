-- Create the drive_ingestion_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.drive_ingestion_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  questions_found INTEGER DEFAULT 0,
  questions_saved INTEGER DEFAULT 0,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add source columns to real_exam_questions if they don't exist
ALTER TABLE public.real_exam_questions ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE public.real_exam_questions ADD COLUMN IF NOT EXISTS source_drive_id TEXT;

-- Enable Row Level Security
ALTER TABLE public.drive_ingestion_log ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to view/insert/update logs
-- Note: Assuming existence of a way to check for admin, like a profile role or metadata.
-- For now, we'll use a broad policy if we can't verify admin role easily, but the Edge Function will handle auth.
CREATE POLICY "Admins can manage drive ingestion logs" 
ON public.drive_ingestion_log 
FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role' OR (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean = true);
