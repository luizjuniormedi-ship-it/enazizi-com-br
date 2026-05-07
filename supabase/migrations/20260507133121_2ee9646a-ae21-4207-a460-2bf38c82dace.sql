-- Update handle_new_user to be more robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_type text;
  _faculdade text;
  _phone text;
  _periodo int;
BEGIN
  _user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'estudante');
  _faculdade := NEW.raw_user_meta_data->>'faculdade';
  _phone := NEW.raw_user_meta_data->>'phone';
  _periodo := (NEW.raw_user_meta_data->>'periodo')::int;

  -- Create profile with ON CONFLICT to avoid registration failure if profile exists
  INSERT INTO public.profiles (user_id, email, display_name, status, user_type, faculdade, phone, periodo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'pending',
    _user_type,
    _faculdade,
    _phone,
    _periodo
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
    user_type = COALESCE(profiles.user_type, EXCLUDED.user_type),
    faculdade = COALESCE(profiles.faculdade, EXCLUDED.faculdade),
    phone = COALESCE(profiles.phone, EXCLUDED.phone),
    periodo = COALESCE(profiles.periodo, EXCLUDED.periodo);

  -- Ensure standard role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Ensure professor/medico roles if applicable
  IF _user_type IN ('professor', 'medico') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'professor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Ensure gamification and quotas
  INSERT INTO public.user_gamification (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_quotas (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
