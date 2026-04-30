-- Evitar conflito com ai_usage_logs existente
ALTER TABLE public.ai_usage_logs RENAME TO ai_enterprise_usage_logs;

-- Atualizar políticas
DROP POLICY IF EXISTS "Admins can view usage logs" ON public.ai_enterprise_usage_logs;
CREATE POLICY "Admins can view enterprise usage logs"
ON public.ai_enterprise_usage_logs FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

DROP POLICY IF EXISTS "Service role can insert usage logs" ON public.ai_enterprise_usage_logs;
CREATE POLICY "Service role can insert enterprise usage logs"
ON public.ai_enterprise_usage_logs FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');
