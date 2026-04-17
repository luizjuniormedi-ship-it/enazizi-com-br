
-- 1. EMAIL TABLES — bloqueio explícito de leitura para authenticated
CREATE POLICY "Deny authenticated read on email_send_log"
ON public.email_send_log FOR SELECT TO authenticated USING (false);

CREATE POLICY "Deny authenticated read on suppressed_emails"
ON public.suppressed_emails FOR SELECT TO authenticated USING (false);

CREATE POLICY "Deny authenticated read on email_unsubscribe_tokens"
ON public.email_unsubscribe_tokens FOR SELECT TO authenticated USING (false);

-- 2. AUTOMATION_TELEMETRY
DROP POLICY IF EXISTS "Service role can insert telemetry" ON public.automation_telemetry;
CREATE POLICY "Service role can insert telemetry"
ON public.automation_telemetry FOR INSERT TO service_role WITH CHECK (true);

-- 3. PIPELINE_ALERTS
DROP POLICY IF EXISTS "Service can insert pipeline alerts" ON public.pipeline_alerts;

-- 4. ASSISTANT_DECISIONS
DROP POLICY IF EXISTS "Admins can view all decisions" ON public.assistant_decisions;
DROP POLICY IF EXISTS "Users can insert own decisions" ON public.assistant_decisions;
DROP POLICY IF EXISTS "Users can view own decisions" ON public.assistant_decisions;

CREATE POLICY "Admins can view all decisions"
ON public.assistant_decisions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own decisions"
ON public.assistant_decisions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decisions"
ON public.assistant_decisions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. VIDEO_ROOMS
DROP POLICY IF EXISTS "Authenticated can read active video rooms" ON public.video_rooms;
CREATE POLICY "Invited students can read video rooms"
ON public.video_rooms FOR SELECT TO authenticated
USING (
  status = 'active'
  AND invited_students ? auth.uid()::text
);

-- 6. USER_GAMIFICATION (coluna correta: xp)
DROP POLICY IF EXISTS "Authenticated read gamification for leaderboard" ON public.user_gamification;

CREATE OR REPLACE FUNCTION public.get_gamification_leaderboard(_limit int DEFAULT 50)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  xp int,
  level int,
  current_streak int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.user_id,
    COALESCE(p.display_name, 'Aluno') AS display_name,
    p.avatar_url,
    COALESCE(g.xp, 0)::int AS xp,
    COALESCE(g.level, 1)::int AS level,
    COALESCE(g.current_streak, 0)::int AS current_streak
  FROM public.user_gamification g
  LEFT JOIN public.profiles p ON p.user_id = g.user_id
  ORDER BY g.xp DESC NULLS LAST
  LIMIT GREATEST(_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_gamification_leaderboard(int) TO authenticated;

-- 7. STORAGE: question-images
DROP POLICY IF EXISTS "Authenticated upload to question images" ON storage.objects;

CREATE POLICY "Staff upload to question images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'professor'::app_role)
    OR has_role(auth.uid(), 'coordinator'::app_role)
    OR has_role(auth.uid(), 'institutional_admin'::app_role)
  )
);

-- 8. USER_ROLES — CHECK adicional
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_valid;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_valid
  CHECK (role IN ('admin', 'user', 'professor', 'coordinator', 'institutional_admin'));
