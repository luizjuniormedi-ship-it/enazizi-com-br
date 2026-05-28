-- Security Fix: Correct broken RLS policies (Freeze v25 - security exception)
-- Fix 1: master_content_library policies using profiles.id instead of profiles.user_id
-- Fix 2: profiles UPDATE policy missing WITH CHECK
-- Fix 3: public access on official_exam_questions and official_exam_sources

-- ============================================
-- FIX 1: master_content_library
-- ============================================

-- Drop broken policy that references profiles.id (never matches)
DROP POLICY IF EXISTS "Admin/Teacher full access" ON public.master_content_library;

-- Recreate with correct profiles.user_id reference
CREATE POLICY "Admin/Teacher full access"
  ON public.master_content_library
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.user_type = ANY (ARRAY['admin'::text, 'teacher'::text, 'master'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.user_type = ANY (ARRAY['admin'::text, 'teacher'::text, 'master'::text])
    )
  );

-- Drop broken student premium policy that references profiles.id
DROP POLICY IF EXISTS "Student limited access" ON public.master_content_library;

-- Recreate with correct profiles.user_id reference
CREATE POLICY "Student limited access"
  ON public.master_content_library
  FOR SELECT
  TO authenticated
  USING (
    status::text = 'published'::text
    AND (
      visibility = 'public'::text
      OR (
        visibility = 'premium'::text
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.user_id = auth.uid()
            AND profiles.status = 'active'::text
        )
      )
    )
  );

-- ============================================
-- FIX 2: profiles UPDATE policy
-- ============================================

-- Add WITH CHECK to profiles UPDATE policy
-- The trigger prevent_profile_role_self_update already blocks role/user_type escalation,
-- but the policy should also have WITH CHECK for defense in depth.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- FIX 3: official_exam_questions public access
-- ============================================

-- Remove public unauthenticated access to official exam questions
DROP POLICY IF EXISTS "Everyone can view exam questions" ON public.official_exam_questions;

-- Create authenticated-only SELECT policy
CREATE POLICY "Authenticated users can view exam questions"
  ON public.official_exam_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- FIX 4: official_exam_sources public access
-- ============================================

-- Remove public unauthenticated access to official exam sources
DROP POLICY IF EXISTS "Everyone can view active sources" ON public.official_exam_sources;

-- Create authenticated-only SELECT policy for active sources
CREATE POLICY "Authenticated users can view active sources"
  ON public.official_exam_sources
  FOR SELECT
  TO authenticated
  USING (is_active = true);