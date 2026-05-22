-- Drop existing functions first
DROP FUNCTION IF EXISTS public.list_student_facets_for_professor();
DROP FUNCTION IF EXISTS public.list_students_for_professor(text, integer, text, integer);

-- Recreate list_students_for_professor to support class filter
CREATE OR REPLACE FUNCTION public.list_students_for_professor(
  _faculdade text DEFAULT NULL,
  _periodo integer DEFAULT NULL,
  _search text DEFAULT NULL,
  _limit integer DEFAULT 200,
  _class_id uuid DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  email text,
  faculdade text,
  periodo integer,
  avatar_url text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
  _my_institution uuid;
  _my_faculdade text;
BEGIN
  -- Get professor context
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role),
    public.user_institution_id(auth.uid()),
    (SELECT faculdade FROM public.profiles WHERE user_id = auth.uid())
  INTO _is_admin, _my_institution, _my_faculdade;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    p.email,
    p.faculdade,
    p.periodo,
    p.avatar_url
  FROM public.profiles p
  WHERE p.user_type = 'estudante'
    AND p.status <> 'blocked'
    AND (
      _is_admin
      OR (
        _my_institution IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.institution_members im
          WHERE im.user_id = p.user_id
            AND im.institution_id = _my_institution
            AND im.is_active = true
        )
      )
      OR (
        _my_institution IS NULL
        AND _my_faculdade IS NOT NULL
        AND p.faculdade = _my_faculdade
      )
      OR EXISTS (
        SELECT 1 FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.user_id
          AND (c.created_by = auth.uid() OR (c.institution_id IS NOT NULL AND c.institution_id = _my_institution))
      )
    )
    AND (_faculdade IS NULL OR p.faculdade = _faculdade)
    AND (_periodo IS NULL OR p.periodo = _periodo)
    AND (_class_id IS NULL OR EXISTS (
      SELECT 1 FROM public.class_members cm 
      WHERE cm.user_id = p.user_id AND cm.class_id = _class_id
    ))
    AND (
      _search IS NULL
      OR p.display_name ILIKE '%' || _search || '%'
      OR p.email ILIKE '%' || _search || '%'
    )
  ORDER BY p.faculdade NULLS LAST, p.periodo NULLS LAST, p.display_name NULLS LAST
  LIMIT GREATEST(LEAST(_limit, 1000), 1);
END;
$function$;

-- Recreate facets function to return classes as well
CREATE OR REPLACE FUNCTION public.list_student_facets_for_professor()
RETURNS TABLE(
  faculdades text[],
  periodos integer[],
  classes jsonb[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _visible_students_ids uuid[];
  _my_institution uuid;
BEGIN
  -- Get professor context
  _my_institution := public.user_institution_id(auth.uid());

  -- Get IDs of visible students (limited for performance in facets)
  SELECT array_agg(user_id) INTO _visible_students_ids 
  FROM public.list_students_for_professor(NULL, NULL, NULL, 500, NULL);

  RETURN QUERY
  SELECT
    COALESCE((SELECT array_agg(DISTINCT p.faculdade) FROM public.profiles p WHERE p.user_id = ANY(_visible_students_ids) AND p.faculdade IS NOT NULL), '{}'::text[]),
    COALESCE((SELECT array_agg(DISTINCT p.periodo) FROM public.profiles p WHERE p.user_id = ANY(_visible_students_ids) AND p.periodo IS NOT NULL), '{}'::integer[]),
    COALESCE((
      SELECT array_agg(jsonb_build_object('id', c.id, 'name', c.name))
      FROM public.classes c
      WHERE c.created_by = auth.uid()
         OR (c.institution_id IS NOT NULL AND c.institution_id = _my_institution)
    ), '{}'::jsonb[]);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_students_for_professor(text, integer, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_facets_for_professor() TO authenticated;
