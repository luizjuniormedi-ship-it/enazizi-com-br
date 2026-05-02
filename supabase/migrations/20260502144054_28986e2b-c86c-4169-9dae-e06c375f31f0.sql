-- Create a bucket for tutor lesson videos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tutor-lesson-videos', 'tutor-lesson-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read videos
CREATE POLICY "Public Access for tutor videos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'tutor-lesson-videos');

-- Allow authenticated users to upload (admins usually)
CREATE POLICY "Authenticated users can upload tutor videos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'tutor-lesson-videos' AND auth.role() = 'authenticated');

-- Allow update/delete
CREATE POLICY "Authenticated users can update/delete tutor videos" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'tutor-lesson-videos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete tutor videos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'tutor-lesson-videos' AND auth.role() = 'authenticated');