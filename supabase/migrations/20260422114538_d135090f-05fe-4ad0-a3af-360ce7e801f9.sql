-- Função SECURITY DEFINER para professores listarem alunos visíveis
-- Critérios (qualquer um):
--   1) Professor é admin (vê todos)
--   2) Aluno está em institution_members compartilhada com o professor (institutional)
--   3) Aluno tem a mesma 'faculdade' do professor (fallback quando institution_members está vazio)
-- Filtros opcionais: faculdade, periodo, busca por nome/email
-- Retorna no máximo 200 linhas
CREATE OR REPLACE FUNCTION public.list_students_for_professor(
  _faculdade text DEFAULT NULL,
  _periodo integer DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 200
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  email text,
  faculdade text,
  periodo integer,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT
      auth.uid() AS uid,
      (SELECT faculdade FROM public.profiles WHERE user_id = auth.uid()) AS my_faculdade,
      public.has_role(auth.uid(), 'admin'::app_role) AS is_admin,
      public.user_institution_id(auth.uid()) AS my_institution
  )
  SELECT
    p.user_id,
    p.display_name,
    p.email,
    p.faculdade,
    p.periodo,
    p.avatar_url
  FROM public.profiles p, me
  WHERE p.user_type = 'estudante'
    AND p.status <> 'blocked'
    AND (
      me.is_admin
      OR (
        me.my_institution IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.institution_members im
          WHERE im.user_id = p.user_id
            AND im.institution_id = me.my_institution
            AND im.is_active = true
        )
      )
      OR (
        me.my_institution IS NULL
        AND me.my_faculdade IS NOT NULL
        AND p.faculdade = me.my_faculdade
      )
    )
    AND (_faculdade IS NULL OR p.faculdade = _faculdade)
    AND (_periodo IS NULL OR p.periodo = _periodo)
    AND (
      _search IS NULL
      OR p.display_name ILIKE '%' || _search || '%'
      OR p.email ILIKE '%' || _search || '%'
    )
  ORDER BY p.faculdade NULLS LAST, p.periodo NULLS LAST, p.display_name NULLS LAST
  LIMIT GREATEST(LEAST(_limit, 500), 1);
$function$;

-- Função auxiliar para retornar facetas (faculdades + períodos disponíveis para o professor)
CREATE OR REPLACE FUNCTION public.list_student_facets_for_professor()
RETURNS TABLE(
  faculdades text[],
  periodos integer[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH visible AS (
    SELECT faculdade, periodo
    FROM public.list_students_for_professor(NULL, NULL, NULL, 500)
  )
  SELECT
    ARRAY(SELECT DISTINCT faculdade FROM visible WHERE faculdade IS NOT NULL ORDER BY faculdade),
    ARRAY(SELECT DISTINCT periodo FROM visible WHERE periodo IS NOT NULL ORDER BY periodo);
$function$;

GRANT EXECUTE ON FUNCTION public.list_students_for_professor(text, integer, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_facets_for_professor() TO authenticated;