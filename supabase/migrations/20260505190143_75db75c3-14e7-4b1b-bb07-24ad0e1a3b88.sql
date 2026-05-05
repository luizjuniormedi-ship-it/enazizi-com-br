-- Alter audit_simulados_bancas to add missing fields
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.simulation_generation_jobs(id) ON DELETE CASCADE;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS batch_number INTEGER;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS batch_size INTEGER;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS generated_count INTEGER;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS failed_count INTEGER;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS elapsed_ms INTEGER;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS applied_profile TEXT;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS alias_used BOOLEAN DEFAULT false;
ALTER TABLE public.audit_simulados_bancas ADD COLUMN IF NOT EXISTS blueprint_found BOOLEAN DEFAULT false;

-- Add RLS and policies
ALTER TABLE public.simulation_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_simulados_bancas ENABLE ROW LEVEL SECURITY;

-- Simulation Jobs Policies
DO $$ BEGIN
    CREATE POLICY "Users can view their own jobs" ON public.simulation_generation_jobs FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can create their own jobs" ON public.simulation_generation_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can update their own jobs" ON public.simulation_generation_jobs FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Audit Policies
DO $$ BEGIN
    CREATE POLICY "Users can view their own audits" ON public.audit_simulados_bancas FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can insert their own audits" ON public.audit_simulados_bancas FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Trigger for updated_at on simulation_generation_jobs
CREATE OR REPLACE FUNCTION public.update_simulation_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_simulation_job_updated_at ON public.simulation_generation_jobs;
CREATE TRIGGER trigger_update_simulation_job_updated_at
BEFORE UPDATE ON public.simulation_generation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_simulation_job_updated_at();