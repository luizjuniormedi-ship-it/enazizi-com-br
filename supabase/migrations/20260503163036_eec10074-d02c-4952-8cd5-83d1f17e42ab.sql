-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up policies for public access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'question-images' );

CREATE POLICY "Service Role Access"
ON storage.objects FOR ALL
USING ( bucket_id = 'question-images' )
WITH CHECK ( bucket_id = 'question-images' );
