
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('video-lessons', 'video-lessons', true, 524288000, ARRAY['video/mp4','video/webm','video/quicktime','application/vnd.apple.mpegurl'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 524288000;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read video-lessons') THEN
    CREATE POLICY "Public read video-lessons" ON storage.objects FOR SELECT USING (bucket_id = 'video-lessons');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Auth upload video-lessons') THEN
    CREATE POLICY "Auth upload video-lessons" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'video-lessons');
  END IF;
END$$;
