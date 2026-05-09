-- Allow authenticated users to insert their own study engine snapshots.
-- Fixes 403 on POST /rest/v1/study_engine_snapshots from client dualWrite.
-- SELECT/UPDATE/DELETE policies remain unchanged.
CREATE POLICY "Users insert own snapshots"
ON public.study_engine_snapshots
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());