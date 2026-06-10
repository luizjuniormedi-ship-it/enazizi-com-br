CREATE OR REPLACE FUNCTION public.list_students_for_professor(_faculdade text DEFAULT NULL::text, _periodo integer DEFAULT NULL::integer, _search text DEFAULT NULL::text, _limit integer DEFAULT 200, _class_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(user_id uuid, display_name text, email text, faculdade text, periodo integer, avatar_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
  _my_institution uuid;
  _my_fac_val text;
BEGIN
  -- Get professor context
  SELECT 
    public.has_role(auth.uid(), 'admin'::app_role),
    public.user_institution_id(auth.uid()),
    (SELECT TRIM(prof.faculdade) FROM public.profiles prof WHERE prof.user_id = auth.uid())
  INTO _is_admin, _my_institution, _my_fac_val;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    p.email,
    p.faculdade,
    p.periodo,
    p.avatar_url
  FROM public.profiles p
  WHERE (p.user_type IN ('estudante', 'student', 'medico', 'user'))
    AND (p.is_blocked IS FALSE OR p.is_blocked IS NULL)
    AND (
      _is_admin
      OR _search IS NOT NULL
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
        _my_fac_val IS NOT NULL AND _my_fac_val <> ''
        AND (TRIM(p.faculdade) = _my_fac_val OR _faculdade IS NOT NULL)
      )
      OR EXISTS (
        SELECT 1 FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.user_id
          AND (c.created_by = auth.uid() OR (c.institution_id IS NOT NULL AND c.institution_id = _my_institution))
      )
      OR (_my_fac_val IS NULL AND _my_institution IS NULL)
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