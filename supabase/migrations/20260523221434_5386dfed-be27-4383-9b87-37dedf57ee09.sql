-- 1. Restrict Service Role Policies to the actual service_role
-- ai_enterprise_usage_logs
DROP POLICY IF EXISTS "Service role can insert enterprise usage logs" ON ai_enterprise_usage_logs;
CREATE POLICY "Service role can insert enterprise usage logs" ON ai_enterprise_usage_logs
FOR INSERT TO service_role WITH CHECK (true);

-- email_send_log
DROP POLICY IF EXISTS "Service role can insert send log" ON email_send_log;
CREATE POLICY "Service role can insert send log" ON email_send_log
FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read send log" ON email_send_log;
CREATE POLICY "Service role can read send log" ON email_send_log
FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role can update send log" ON email_send_log;
CREATE POLICY "Service role can update send log" ON email_send_log
FOR UPDATE TO service_role USING (true);

-- email_send_state
DROP POLICY IF EXISTS "Service role can manage send state" ON email_send_state;
CREATE POLICY "Service role can manage send state" ON email_send_state
FOR ALL TO service_role USING (true);

-- suppressed_emails
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON suppressed_emails;
CREATE POLICY "Service role can insert suppressed emails" ON suppressed_emails
FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read suppressed emails" ON suppressed_emails;
CREATE POLICY "Service role can read suppressed emails" ON suppressed_emails
FOR SELECT TO service_role USING (true);

-- email_unsubscribe_tokens
DROP POLICY IF EXISTS "Service role can insert tokens" ON email_unsubscribe_tokens;
CREATE POLICY "Service role can insert tokens" ON email_unsubscribe_tokens
FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can mark tokens as used" ON email_unsubscribe_tokens;
CREATE POLICY "Service role can mark tokens as used" ON email_unsubscribe_tokens
FOR UPDATE TO service_role USING (true);

DROP POLICY IF EXISTS "Service role can read tokens" ON email_unsubscribe_tokens;
CREATE POLICY "Service role can read tokens" ON email_unsubscribe_tokens
FOR SELECT TO service_role USING (true);

-- 2. Hardening Storage Policies (without ALTER TABLE)
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "tutor_lesson_videos_staff_select" ON storage.objects;
CREATE POLICY "tutor_lesson_videos_staff_select" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (bucket_id = 'tutor-lesson-videos' AND is_lesson_staff(auth.uid()));

DROP POLICY IF EXISTS "tutor_lesson_videos_staff_insert" ON storage.objects;
CREATE POLICY "tutor_lesson_videos_staff_insert" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'tutor-lesson-videos' AND is_lesson_staff(auth.uid()));

DROP POLICY IF EXISTS "tutor_lesson_videos_staff_update" ON storage.objects;
CREATE POLICY "tutor_lesson_videos_staff_update" 
ON storage.objects 
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'tutor-lesson-videos' AND is_lesson_staff(auth.uid()));

DROP POLICY IF EXISTS "tutor_lesson_videos_staff_delete" ON storage.objects;
CREATE POLICY "tutor_lesson_videos_staff_delete" 
ON storage.objects 
FOR DELETE 
TO authenticated 
USING (bucket_id = 'tutor-lesson-videos' AND is_lesson_staff(auth.uid()));

-- 3. Set search_path for key functions
ALTER FUNCTION has_role(uuid, app_role) SET search_path = public, auth;
ALTER FUNCTION is_lesson_staff(uuid) SET search_path = public, auth;
ALTER FUNCTION user_institution_id(uuid) SET search_path = public, auth;
