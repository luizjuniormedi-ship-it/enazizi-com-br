-- Loop Pedagógico — GRANTs ausentes (causa raiz dos 403 em INSERT)
-- RLS e policies permanecem intactas; apenas privilégios SQL base.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_bank TO authenticated;
GRANT ALL ON public.error_bank TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fsrs_cards TO authenticated;
GRANT ALL ON public.fsrs_cards TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_sessions TO authenticated;
GRANT ALL ON public.simulado_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_answers TO authenticated;
GRANT ALL ON public.simulado_answers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_attempts TO authenticated;
GRANT ALL ON public.practice_attempts TO service_role;