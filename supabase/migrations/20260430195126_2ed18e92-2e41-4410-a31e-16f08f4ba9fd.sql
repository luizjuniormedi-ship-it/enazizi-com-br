-- Fix function search path
ALTER FUNCTION public.check_medical_publication_readiness() SET search_path = public;

-- Add missing policies for governance_audit_logs
CREATE POLICY "Admins can view all logs" ON public.governance_audit_logs
FOR SELECT TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view logs for content they are related to" ON public.governance_audit_logs
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.master_content_library 
        WHERE id = governance_audit_logs.content_id 
        AND (auth.jwt() ->> 'role' IN ('admin', 'professor', 'medical_specialist'))
    )
);

-- Ensure default restrictive policy for scores
CREATE POLICY "Strict isolation for medical scores" ON public.medical_content_scores
FOR ALL TO authenticated
USING (auth.jwt() ->> 'role' IN ('admin', 'professor', 'medical_specialist'))
WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'professor', 'medical_specialist'));
