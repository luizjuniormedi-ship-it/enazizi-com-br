
-- Quebra o ciclo de recursão RLS entre mentor_theme_plans e mentor_theme_plan_targets
-- usando funções SECURITY DEFINER que ignoram RLS internamente.

-- 1) Função: usuário pode ler plano X? (verifica targets sem disparar RLS)
CREATE OR REPLACE FUNCTION public.user_can_read_mentor_plan(_user_id uuid, _plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mentor_theme_plan_targets t
    WHERE t.plan_id = _plan_id
      AND (
        (t.target_type = 'student' AND t.target_id = _user_id)
        OR (t.target_type = 'class' AND t.target_id IN (
              SELECT cm.class_id FROM public.class_members cm
              WHERE cm.user_id = _user_id AND cm.is_active = true
          ))
        OR (t.target_type = 'institution' AND t.target_id = public.user_institution_id(_user_id))
      )
  );
$$;

-- 2) Função: professor é dono do plano X? (sem disparar RLS)
CREATE OR REPLACE FUNCTION public.professor_owns_mentor_plan(_user_id uuid, _plan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mentor_theme_plans p
    WHERE p.id = _plan_id AND p.professor_id = _user_id
  );
$$;

-- 3) Recriar políticas SEM cross-reference direto

-- mentor_theme_plans: substitui "Students can read targeted plans"
DROP POLICY IF EXISTS "Students can read targeted plans" ON public.mentor_theme_plans;
CREATE POLICY "Students can read targeted plans"
ON public.mentor_theme_plans
FOR SELECT
TO authenticated
USING (public.user_can_read_mentor_plan(auth.uid(), id));

-- mentor_theme_plan_targets: substitui "Professors manage targets of own plans"
DROP POLICY IF EXISTS "Professors manage targets of own plans" ON public.mentor_theme_plan_targets;
CREATE POLICY "Professors manage targets of own plans"
ON public.mentor_theme_plan_targets
FOR ALL
TO authenticated
USING (public.professor_owns_mentor_plan(auth.uid(), plan_id))
WITH CHECK (public.professor_owns_mentor_plan(auth.uid(), plan_id));
