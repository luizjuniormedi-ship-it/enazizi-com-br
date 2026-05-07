-- Update the handle_new_user function to set status back to 'pending'
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

  INSERT INTO public.profiles (user_id, email, display_name, status, user_type, faculdade, phone, periodo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'pending', -- Changed back to 'pending' as requested
    _user_type,
    _faculdade,
    _phone,
    _periodo
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  IF _user_type IN ('professor', 'medico') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'professor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.user_gamification (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_quotas (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Update the default value for the status column
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';