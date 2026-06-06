-- P0: Hardening handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- FORCED: Every user starts as a pending student, regardless of frontend metadata
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
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.email,
    'student', -- FORCED
    'student', -- FORCED
    'pending'  -- FORCED
  );

  -- Initial student role assignment
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- P1: Canonical user_roles helper for RLS
CREATE OR REPLACE FUNCTION public.has_role(target_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role::text = target_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- P5: Continuous Security Audit Engine
CREATE OR REPLACE FUNCTION public.run_security_audit()
RETURNS TABLE (issue_type TEXT, location TEXT, description TEXT) AS $$
BEGIN
    -- Detect policies using legacy profile fields
    RETURN QUERY 
    SELECT 
        'INSECURE_POLICY'::TEXT,
        (tablename || '.' || policyname)::TEXT,
        ('Policy uses profiles.role or user_type: ' || qual)::TEXT
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (qual LIKE '%profiles.role%' OR qual LIKE '%profiles.user_type%' OR with_check LIKE '%profiles.role%');

    -- Detect views using legacy profile fields
    RETURN QUERY
    SELECT 
        'INSECURE_VIEW'::TEXT,
        v.table_name::TEXT,
        'View definition references legacy profile role/type fields'::TEXT
    FROM information_schema.views v
    WHERE v.table_schema = 'public'
    AND v.view_definition ILIKE '%profiles.role%' OR v.view_definition ILIKE '%profiles.user_type%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Immediate remediation for high-risk tables
DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
CREATE POLICY "Admins have full access" ON public.profiles
    FOR ALL USING (public.has_role('admin'));

DROP POLICY IF EXISTS "Admins can view enterprise usage logs" ON public.ai_enterprise_usage_logs;
CREATE POLICY "Admins can view enterprise usage logs" ON public.ai_enterprise_usage_logs
    FOR ALL USING (public.has_role('admin'));
