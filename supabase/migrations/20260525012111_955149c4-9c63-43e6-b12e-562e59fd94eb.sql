-- Fix infinite recursion in profiles table
DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by own user" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are updatable by own user" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are insertable by own user" ON public.profiles;

-- Create clean, non-recursive policies
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Admin policy using user_roles table to avoid recursion on profiles table
CREATE POLICY "Admins have full access" 
ON public.profiles 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Also ensure user_roles has proper RLS to avoid issues there
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Ensure we have the necessary RPCs for the login screen stats if they are missing
-- (The login screen was calling get_login_stats and get_login_testimonials)
