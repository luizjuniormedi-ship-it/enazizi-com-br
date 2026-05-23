ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS study_reminders boolean DEFAULT true;