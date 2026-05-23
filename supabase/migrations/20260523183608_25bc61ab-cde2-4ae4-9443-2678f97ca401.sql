-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS study_reminders BOOLEAN NOT NULL DEFAULT true;

-- Ensure RLS allows the user to see and update these columns (they are part of the table)
-- No new policies needed as existing policies on profiles should cover this.

-- Update comment for documentation
COMMENT ON COLUMN public.profiles.notifications_enabled IS 'Whether the user has general notifications enabled.';
COMMENT ON COLUMN public.profiles.study_reminders IS 'Whether the user has study reminders enabled.';
