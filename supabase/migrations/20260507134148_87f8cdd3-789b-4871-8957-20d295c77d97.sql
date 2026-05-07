-- Ensure defaults and constraints for profiles
ALTER TABLE public.profiles 
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN role SET DEFAULT 'student',
  ALTER COLUMN user_type SET DEFAULT 'estudante';

-- Update the handle_new_user trigger to be more resilient
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _role text;
  _full_name text;
  _faculdade text;
  _phone text;
  _periodo int;
BEGIN
  -- Extract metadata with fallbacks
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', '');
  _role := COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_user_meta_data->>'user_type', 'student');
  _faculdade := NEW.raw_user_meta_data->>'faculdade';
  _phone := NEW.raw_user_meta_data->>'phone';
  
  -- Safe cast for periodo
  BEGIN
    _periodo := (NEW.raw_user_meta_data->>'periodo')::int;
  EXCEPTION WHEN OTHERS THEN
    _periodo := NULL;
  END;

  -- Insert into profiles using NEW.id for both id and user_id to ensure consistency
  INSERT INTO public.profiles (
    id,
    user_id,
    email,
    display_name,
    full_name,
    role,
    user_type,
    status,
    faculdade,
    phone,
    periodo,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    _full_name,
    _full_name,
    _role,
    _role, -- mapping role to user_type for legacy compatibility
    'pending',
    _faculdade,
    _phone,
    _periodo,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    updated_at = now();

  -- Side effects (Roles table)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF _role IN ('professor', 'medico', 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'professor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Side effects (Gamification & Quotas)
  INSERT INTO public.user_gamification (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_quotas (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error and continue to not block auth.users creation
  -- In a real scenario, you might want to use RAISE WARNING or log to a table
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = id);
