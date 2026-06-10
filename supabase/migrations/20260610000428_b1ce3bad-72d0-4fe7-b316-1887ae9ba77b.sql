CREATE OR REPLACE FUNCTION public.list_students_for_professor(_faculdade text DEFAULT NULL::text, _periodo integer DEFAULT NULL::integer, _search text DEFAULT NULL::text, _limit integer DEFAULT 200, _class_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(user_id uuid, display_name text, email text, faculdade text, periodo integer, avatar_url text)
 LANGUAGE plpgsql
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
    (SELECT TRIM(faculdade) FROM public.profiles WHERE user_id = auth.uid())
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
  WHERE (p.user_type IN ('estudante', 'student', 'user'))
    AND (p.is_blocked IS FALSE OR p.is_blocked IS NULL)
    AND (
      _is_admin
      OR _search IS NOT NULL -- Allow global search for professors to find specific students
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
        _my_faculdade IS NOT NULL AND _my_faculdade <> ''
        AND (TRIM(p.faculdade) = _my_faculdade OR _faculdade IS NOT NULL) -- If filtering by faculdade, allow it
      )
      OR EXISTS (
        SELECT 1 FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.user_id
          AND (c.created_by = auth.uid() OR (c.institution_id IS NOT NULL AND c.institution_id = _my_institution))
      )
      OR (_my_faculdade IS NULL AND _my_institution IS NULL) -- If professor has no restrictions, show all (sample)
    )
    AND (_faculdade IS NULL OR TRIM(p.faculdade) = TRIM(_faculdade))
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
  ORDER BY 
    CASE WHEN _search IS NOT NULL THEN (p.display_name ILIKE _search || '%')::int ELSE 0 END DESC,
    p.faculdade NULLS LAST, 
    p.periodo NULLS LAST, 
    p.display_name NULLS LAST
  LIMIT GREATEST(LEAST(_limit, 1000), 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_student_facets_for_professor()
 RETURNS TABLE(faculdades text[], periodos integer[], classes jsonb[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  _my_institution uuid;
  _my_faculdade text;
  _is_admin boolean;
BEGIN
  -- Get professor context
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role),
    public.user_institution_id(auth.uid()),
    (SELECT TRIM(faculdade) FROM public.profiles WHERE user_id = auth.uid())
  INTO _is_admin, _my_institution, _my_faculdade;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT array_agg(DISTINCT p.faculdade) 
      FROM public.profiles p 
      WHERE p.faculdade IS NOT NULL AND p.faculdade <> ''
      AND (
        _is_admin 
        OR _my_institution IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.institution_members im 
          WHERE im.user_id = p.user_id AND im.institution_id = _my_institution
        )
      )
    ), '{}'::text[]),
    COALESCE((
      SELECT array_agg(DISTINCT p.periodo) 
      FROM public.profiles p 
      WHERE p.periodo IS NOT NULL
      AND (
        _is_admin 
        OR _my_institution IS NULL 
        OR EXISTS (
          SELECT 1 FROM public.institution_members im 
          WHERE im.user_id = p.user_id AND im.institution_id = _my_institution
        )
      )
    ), '{}'::integer[]),
    COALESCE((
      SELECT array_agg(jsonb_build_object('id', c.id, 'name', c.name))
      FROM public.classes c
      WHERE c.created_by = auth.uid()
         OR (c.institution_id IS NOT NULL AND c.institution_id = _my_institution)
    ), '{}'::jsonb[]);
END;
$function$;