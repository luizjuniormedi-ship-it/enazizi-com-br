-- Add new columns if they don't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'notifications_enabled') THEN
    ALTER TABLE public.profiles ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'study_reminders') THEN
    ALTER TABLE public.profiles ADD COLUMN study_reminders BOOLEAN DEFAULT true;
  END IF;
END $$;