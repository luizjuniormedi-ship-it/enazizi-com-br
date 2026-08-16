-- P0: protect the existing professor student directory RPCs.
--
-- These functions are SECURITY DEFINER because they must read profiles through
-- RLS, so execution is an authorization boundary. The prior implementation:
--   * granted EXECUTE to PUBLIC (therefore also anon); and
--   * widened visibility whenever _search was present or the caller had no
--     institution/faculdade.
--
-- This migration changes no data and introduces no parallel API. It preserves
-- the current RPC signatures while requiring a canonical privileged role and
-- making search/facets respect the caller's existing scope.

CREATE OR REPLACE FUNCTION public.list_students_for_professor(
  _faculdade text DEFAULT NULL::text,
  _periodo integer DEFAULT NULL::integer,
  _search text DEFAULT NULL::text,
  _limit integer DEFAULT 200,
  _class_id uuid DEFAULT NULL::uuid
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
SET search_path = ''
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _is_admin boolean := false;
  _is_educator boolean := false;
  _my_institution uuid;
  _my_faculdade text;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT
    public.has_role(_caller_id, 'admin'::public.app_role),
    (
      public.has_role(_caller_id, 'professor'::public.app_role)
      OR public.has_role(_caller_id, 'coordinator'::public.app_role)
      OR public.has_role(_caller_id, 'institutional_admin'::public.app_role)
    ),
    public.user_institution_id(_caller_id),
    (SELECT NULLIF(TRIM(p.faculdade), '') FROM public.profiles p WHERE p.user_id = _caller_id)
  INTO _is_admin, _is_educator, _my_institution, _my_faculdade;

  IF NOT (_is_admin OR _is_educator) THEN
    RAISE EXCEPTION 'professor role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.display_name,
    p.email,
    p.faculdade,
    p.periodo,
    p.avatar_url
  FROM public.profiles p
  WHERE p.user_type IN ('estudante', 'student', 'medico', 'user')
    AND (p.is_blocked IS FALSE OR p.is_blocked IS NULL)
    AND (
      _is_admin
      OR (
        _my_institution IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.institution_members im
          WHERE im.user_id = p.user_id
            AND im.institution_id = _my_institution
            AND im.is_active = true
        )
      )
      OR (
        _my_institution IS NULL
        AND _my_faculdade IS NOT NULL
        AND NULLIF(TRIM(p.faculdade), '') = _my_faculdade
      )
      OR EXISTS (
        SELECT 1
        FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.user_id
          AND cm.is_active = true
          AND (
            c.created_by = _caller_id
            OR (
              _my_institution IS NOT NULL
              AND c.institution_id = _my_institution
            )
          )
      )
    )
    AND (_faculdade IS NULL OR TRIM(p.faculdade) = TRIM(_faculdade))
    AND (_periodo IS NULL OR p.periodo = _periodo)
    AND (
      _class_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.class_members cm
        JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.user_id
          AND cm.class_id = _class_id
          AND cm.is_active = true
          AND (
            c.created_by = _caller_id
            OR (
              _my_institution IS NOT NULL
              AND c.institution_id = _my_institution
            )
          )
      )
    )
    AND (
      _search IS NULL
      OR p.display_name ILIKE '%' || _search || '%'
      OR p.email ILIKE '%' || _search || '%'
    )
  ORDER BY
    CASE WHEN _search IS NOT NULL THEN (p.display_name ILIKE _search || '%')::integer ELSE 0 END DESC,
    p.faculdade NULLS LAST,
    p.periodo NULLS LAST,
    p.display_name NULLS LAST
  LIMIT GREATEST(LEAST(COALESCE(_limit, 200), 1000), 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_student_facets_for_professor()
RETURNS TABLE(faculdades text[], periodos integer[], classes jsonb[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  _caller_id uuid := auth.uid();
  _my_institution uuid;
  _my_faculdade text;
  _is_admin boolean := false;
  _is_educator boolean := false;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT
    public.has_role(_caller_id, 'admin'::public.app_role),
    (
      public.has_role(_caller_id, 'professor'::public.app_role)
      OR public.has_role(_caller_id, 'coordinator'::public.app_role)
      OR public.has_role(_caller_id, 'institutional_admin'::public.app_role)
    ),
    public.user_institution_id(_caller_id),
    (SELECT NULLIF(TRIM(p.faculdade), '') FROM public.profiles p WHERE p.user_id = _caller_id)
  INTO _is_admin, _is_educator, _my_institution, _my_faculdade;

  IF NOT (_is_admin OR _is_educator) THEN
    RAISE EXCEPTION 'professor role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH visible_students AS (
    SELECT p.user_id, p.faculdade, p.periodo
    FROM public.profiles p
    WHERE p.user_type IN ('estudante', 'student', 'medico', 'user')
      AND (p.is_blocked IS FALSE OR p.is_blocked IS NULL)
      AND (
        _is_admin
        OR (
          _my_institution IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.institution_members im
            WHERE im.user_id = p.user_id
              AND im.institution_id = _my_institution
              AND im.is_active = true
          )
        )
        OR (
          _my_institution IS NULL
          AND _my_faculdade IS NOT NULL
          AND NULLIF(TRIM(p.faculdade), '') = _my_faculdade
        )
        OR EXISTS (
          SELECT 1
          FROM public.class_members cm
          JOIN public.classes c ON c.id = cm.class_id
          WHERE cm.user_id = p.user_id
            AND cm.is_active = true
            AND (
              c.created_by = _caller_id
              OR (
                _my_institution IS NOT NULL
                AND c.institution_id = _my_institution
              )
            )
        )
      )
  )
  SELECT
    COALESCE(
      (SELECT array_agg(DISTINCT vs.faculdade ORDER BY vs.faculdade)
       FROM visible_students vs
       WHERE vs.faculdade IS NOT NULL AND vs.faculdade <> ''),
      '{}'::text[]
    ),
    COALESCE(
      (SELECT array_agg(DISTINCT vs.periodo ORDER BY vs.periodo)
       FROM visible_students vs
       WHERE vs.periodo IS NOT NULL),
      '{}'::integer[]
    ),
    COALESCE(
      (SELECT array_agg(jsonb_build_object('id', c.id, 'name', c.name) ORDER BY c.name)
       FROM public.classes c
       WHERE _is_admin
          OR c.created_by = _caller_id
          OR (
            _my_institution IS NOT NULL
            AND c.institution_id = _my_institution
          )),
      '{}'::jsonb[]
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_students_for_professor(text, integer, text, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_students_for_professor(text, integer, text, integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.list_student_facets_for_professor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_student_facets_for_professor() FROM anon;

GRANT EXECUTE ON FUNCTION public.list_students_for_professor(text, integer, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_facets_for_professor() TO authenticated;

-- Fail the migration if its access-control postconditions are not true.
DO $validation$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.list_students_for_professor(text,integer,text,integer,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'P0 validation failed: anon can execute list_students_for_professor';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.list_student_facets_for_professor()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'P0 validation failed: anon can execute list_student_facets_for_professor';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.list_students_for_professor(text,integer,text,integer,uuid)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.list_student_facets_for_professor()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'P0 validation failed: authenticated professor RPC access is missing';
  END IF;
END;
$validation$;

-- Rollback (only if an application regression requires immediate restoration):
-- 1. Reapply the two function definitions from migrations 20260610000716 and
--    20260610000428.
-- 2. Restore only authenticated EXECUTE. Do not restore PUBLIC/anon EXECUTE;
--    those grants are the security defect fixed here.
