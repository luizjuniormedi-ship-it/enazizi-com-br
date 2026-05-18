CREATE TABLE IF NOT EXISTS public.drive_folders_scan (
    id TEXT PRIMARY KEY,
    name TEXT,
    path TEXT,
    parent_id TEXT,
    files_count INTEGER DEFAULT 0,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS just in case but we'll use service role
ALTER TABLE public.drive_folders_scan ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can do everything" ON public.drive_folders_scan FOR ALL USING (true);
