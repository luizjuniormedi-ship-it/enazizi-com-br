ALTER VIEW public.v_banca_question_coverage SET (security_invoker = true);

-- Restringe acesso direto à view: só admins via service role / função
REVOKE ALL ON public.v_banca_question_coverage FROM anon, authenticated;