GRANT EXECUTE ON FUNCTION public.list_students_for_professor(text, integer, text, integer, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_student_facets_for_professor() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_institution_id(uuid) TO PUBLIC;