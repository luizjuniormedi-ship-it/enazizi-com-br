CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _role text;
  _full_name text;
  _faculdade text;
  _phone text;
  _periodo int;
BEGIN
  -- Extração segura de metadados
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', '');
  _role := COALESCE(NEW.raw_user_meta_data->>'role', NEW.raw_user_meta_data->>'user_type', 'student');
  _faculdade := NEW.raw_user_meta_data->>'faculdade';
  _phone := NEW.raw_user_meta_data->>'phone';
  
  -- Conversão segura para inteiro
  BEGIN
    _periodo := (NEW.raw_user_meta_data->>'periodo')::int;
  EXCEPTION WHEN OTHERS THEN
    _periodo := NULL;
  END;

  -- Inserção ou atualização do perfil
  -- Usamos o ID do auth.users para ambos os campos para manter sincronia total
  BEGIN
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
      role = COALESCE(profiles.role, EXCLUDED.role),
      user_type = COALESCE(profiles.user_type, EXCLUDED.user_type),
      faculdade = COALESCE(profiles.faculdade, EXCLUDED.faculdade),
      phone = COALESCE(profiles.phone, EXCLUDED.phone),
      periodo = COALESCE(profiles.periodo, EXCLUDED.periodo),
      updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: Se a inserção completa falhar, tenta o mínimo necessário
    BEGIN
      INSERT INTO public.profiles (id, user_id, email, display_name, status)
      VALUES (NEW.id, NEW.id, NEW.email, COALESCE(_full_name, split_part(NEW.email, '@', 1)), 'pending')
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Silencia erro para não bloquear o auth.users
    END;
  END;

  -- Atribuição de papéis (tabela user_roles)
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;

    IF _role IN ('professor', 'medico', 'admin') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'professor'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Silencia erro para não bloquear o cadastro
  END;

  -- Gamificação e Cotas
  BEGIN
    INSERT INTO public.user_gamification (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN END;

  BEGIN
    INSERT INTO public.user_quotas (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;