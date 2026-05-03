-- Atualizar a função handle_new_user para ativar estudantes automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
    'active', -- Todos entram como active por padrão agora
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar usuários estudantes que estão atualmente pendentes para resolver o problema de acesso relatado
UPDATE public.profiles 
SET status = 'active' 
WHERE status = 'pending' AND user_type = 'estudante';
