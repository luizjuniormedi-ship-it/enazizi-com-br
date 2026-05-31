CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_id,
    display_name,
    full_name,
    email,
    user_type,
    role,
    status
  )
  VALUES (
    new.id,
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'user_type', 'student'),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    user_id = EXCLUDED.id;
  RETURN new;
END;
$function$;