-- Add governance columns to flashcard_generation_jobs
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'flashcard_generation_jobs' AND column_name = 'correlation_id') THEN
        ALTER TABLE public.flashcard_generation_jobs ADD COLUMN correlation_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'flashcard_generation_jobs' AND column_name = 'request_id') THEN
        ALTER TABLE public.flashcard_generation_jobs ADD COLUMN request_id UUID;
    END IF;
END $$;

-- Add governance columns to mnemonic_requests
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mnemonic_requests' AND column_name = 'correlation_id') THEN
        ALTER TABLE public.mnemonic_requests ADD COLUMN correlation_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mnemonic_requests' AND column_name = 'request_id') THEN
        ALTER TABLE public.mnemonic_requests ADD COLUMN request_id UUID;
    END IF;
END $$;

-- Add correlation_id to mnemonic_results
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mnemonic_results' AND column_name = 'correlation_id') THEN
        ALTER TABLE public.mnemonic_results ADD COLUMN correlation_id UUID;
    END IF;
END $$;

-- Ensure edge_execution_logs table structure
CREATE TABLE IF NOT EXISTS public.edge_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT NOT NULL,
    request_id UUID,
    correlation_id UUID,
    method TEXT,
    status_code INTEGER,
    latency_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure ai_governance_logs exists
CREATE TABLE IF NOT EXISTS public.ai_governance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id UUID,
    model TEXT,
    latency_ms INTEGER,
    cost NUMERIC(10,6),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    task_type TEXT,
    hallucination_score INTEGER,
    medical_consistency_score INTEGER,
    quality_lock_status TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure ai_incidents exists
CREATE TABLE IF NOT EXISTS public.ai_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT,
    model_name TEXT,
    severity TEXT,
    incident_type TEXT,
    message TEXT,
    stack_trace TEXT,
    correlation_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
