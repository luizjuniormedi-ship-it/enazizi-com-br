ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_study_plan_reset_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_study_plan_reset_at
ON public.profiles(user_id, last_study_plan_reset_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update their study reset marker'
  ) THEN
    CREATE POLICY "Users can update their study reset marker"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;