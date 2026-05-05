-- Create enum for job status
DO $$ BEGIN
    CREATE TYPE public.simulation_job_status AS ENUM ('pending', 'processing', 'partial', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create simulation_generation_jobs table
CREATE TABLE IF NOT EXISTS public.simulation_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    status public.simulation_job_status DEFAULT 'pending' NOT NULL,
    total_questions INTEGER NOT NULL,
    generated_questions INTEGER DEFAULT 0 NOT NULL,
    failed_questions INTEGER DEFAULT 0 NOT NULL,
    config JSONB DEFAULT '{}'::jsonb NOT NULL,
    results JSONB DEFAULT '[]'::jsonb NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create audit_simulados_bancas table
CREATE TABLE IF NOT EXISTS public.audit_simulados_bancas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID,
    user_id UUID NOT NULL,
    batch_number INTEGER NOT NULL,
    batch_size INTEGER NOT NULL,
    generated_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL,
    elapsed_ms INTEGER NOT NULL,
    target_exam TEXT,
    applied_profile TEXT,
    alias_used BOOLEAN DEFAULT false,
    blueprint_found BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);