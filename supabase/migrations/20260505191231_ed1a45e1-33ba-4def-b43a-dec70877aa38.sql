-- Add missing columns to audit_simulados_bancas
ALTER TABLE public.audit_simulados_bancas 
ADD COLUMN IF NOT EXISTS target_exam TEXT;

-- Ensure indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_simulados_job_id ON public.audit_simulados_bancas(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_simulados_user_id ON public.audit_simulados_bancas(user_id);
