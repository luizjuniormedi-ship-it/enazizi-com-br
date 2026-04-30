-- 1. Fix search_path para segurança (evitar mutabilidade)
ALTER FUNCTION public.audit_ai_content_status_change() SET search_path = public;

-- 2. Revogar execução pública de funções críticas
REVOKE EXECUTE ON FUNCTION public.audit_ai_content_status_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_ai_content_status_change() TO authenticated, service_role;

-- 3. Garantir que as tabelas tenham políticas para todas as operações necessárias (Admins apenas)
-- Auditoria (Insert via trigger, Select via Admin)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.ai_content_audit_logs;
CREATE POLICY "System can insert audit logs"
ON public.ai_content_audit_logs FOR INSERT
WITH CHECK (true); -- Permitido porque o trigger roda como SECURITY DEFINER

-- Uso (Insert via Edge Function/Service Role, Select via Admin)
DROP POLICY IF EXISTS "Service role can insert usage logs" ON public.ai_usage_logs;
CREATE POLICY "Service role can insert usage logs"
ON public.ai_usage_logs FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
