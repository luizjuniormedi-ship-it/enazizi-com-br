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

  -- Insert into profiles using NEW.id for both id and user_id
  -- Using ON CONFLICT (user_id) because it's a unique constraint
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
    _role,
    'pending',
    _faculdade,
    _phone,
    _periodo,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
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
  -- Never block the main auth signup
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
