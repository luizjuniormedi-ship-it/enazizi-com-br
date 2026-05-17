-- Correcting ai_governance_logs to match Enterprise Router expectations
ALTER TABLE public.ai_governance_logs 
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS token_usage JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Rename audited_at to created_at if it's the primary timestamp or just add created_at
ALTER TABLE public.ai_governance_logs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();
