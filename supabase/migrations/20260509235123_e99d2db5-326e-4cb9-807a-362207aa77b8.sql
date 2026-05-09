DROP POLICY IF EXISTS "Service role can manage logs" ON public.mnemonic_agent_logs;
CREATE POLICY "service_role_manages_mnemonic_agent_logs"
  ON public.mnemonic_agent_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "admins_view_mnemonic_agent_logs"
  ON public.mnemonic_agent_logs FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));