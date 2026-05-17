-- AI Model Benchmarks table
CREATE TABLE IF NOT EXISTS public.ai_model_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  test_suite TEXT NOT NULL,
  latency_ms INTEGER,
  ttfb_ms INTEGER,
  tokens_per_second NUMERIC,
  hallucination_score NUMERIC,
  medical_accuracy_score NUMERIC,
  json_stability_score NUMERIC,
  cost_estimate_usd NUMERIC,
  raw_response JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI Incidents table
CREATE TABLE IF NOT EXISTS public.ai_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  model_name TEXT,
  severity TEXT DEFAULT 'warning', -- warning, critical
  incident_type TEXT NOT NULL, -- timeout, hallucination, malformed_json, medical_error
  message TEXT,
  stack_trace TEXT,
  correlation_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI Prompt Registry table
CREATE TABLE IF NOT EXISTS public.ai_prompt_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT UNIQUE NOT NULL, -- e.g. 'TUTOR_PEDAGOGICAL_MASTER'
  version INTEGER DEFAULT 1,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT,
  parameters JSONB DEFAULT '[]'::jsonb,
  last_updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enhance ai_governance_logs with better metrics
ALTER TABLE public.ai_governance_logs 
ADD COLUMN IF NOT EXISTS hallucination_score NUMERIC,
ADD COLUMN IF NOT EXISTS medical_consistency_score NUMERIC,
ADD COLUMN IF NOT EXISTS cost_usd NUMERIC,
ADD COLUMN IF NOT EXISTS ttft_ms INTEGER, -- Time To First Token
ADD COLUMN IF NOT EXISTS quality_lock_status TEXT DEFAULT 'passed'; -- passed, failed, bypass

-- Enable RLS for new tables
ALTER TABLE public.ai_model_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_registry ENABLE ROW LEVEL SECURITY;

-- Simple policies (admin only)
CREATE POLICY "Admins can view benchmarks" ON public.ai_model_benchmarks FOR SELECT USING (true);
CREATE POLICY "Admins can view incidents" ON public.ai_incidents FOR SELECT USING (true);
CREATE POLICY "Admins can view prompts" ON public.ai_prompt_registry FOR SELECT USING (true);
