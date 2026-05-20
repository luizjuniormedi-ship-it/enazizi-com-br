-- Create AI Model Capabilities table
CREATE TABLE IF NOT EXISTS public.ai_model_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    category TEXT, -- e.g., 'fast', 'reasoning', 'cheap', 'advanced_reasoning'
    reasoning_score INTEGER DEFAULT 0,
    pedagogy_score INTEGER DEFAULT 0,
    creativity_score INTEGER DEFAULT 0,
    latency_score INTEGER DEFAULT 0,
    json_reliability INTEGER DEFAULT 0,
    multimodal_support BOOLEAN DEFAULT false,
    streaming_support BOOLEAN DEFAULT true,
    cost_per_1k_input NUMERIC DEFAULT 0,
    cost_per_1k_output NUMERIC DEFAULT 0,
    fallback_priority INTEGER DEFAULT 0,
    max_context INTEGER DEFAULT 8192,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_model_capabilities ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Enable read access for all users" ON public.ai_model_capabilities
    FOR SELECT USING (auth.role() = 'authenticated');

-- Seed default models
INSERT INTO public.ai_model_capabilities (model_name, provider, category, reasoning_score, pedagogy_score, creativity_score, latency_score, json_reliability, cost_per_1k_input, cost_per_1k_output, fallback_priority, max_context)
VALUES 
('google/gemini-2.5-flash', 'google', 'fast', 85, 90, 80, 95, 90, 0.0001, 0.0004, 1, 1000000),
('google/gemini-2.5-pro', 'google', 'reasoning', 95, 95, 90, 70, 95, 0.0035, 0.0105, 2, 2000000),
('google/gemini-2.5-flash-lite', 'google', 'cheap', 75, 80, 70, 98, 85, 0.00005, 0.0001, 3, 1000000),
('openai/gpt-5.5', 'openai', 'fallback', 98, 92, 95, 80, 98, 0.01, 0.03, 4, 128000),
('openai/gpt-5.5-pro', 'openai', 'advanced_reasoning', 100, 98, 98, 60, 99, 0.015, 0.045, 5, 128000)
ON CONFLICT (model_name) DO UPDATE SET
    category = EXCLUDED.category,
    reasoning_score = EXCLUDED.reasoning_score,
    pedagogy_score = EXCLUDED.pedagogy_score,
    cost_per_1k_input = EXCLUDED.cost_per_1k_input,
    cost_per_1k_output = EXCLUDED.cost_per_1k_output;

-- Add scoring columns to ai_governance_logs if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_governance_logs' AND column_name='pedagogy_score') THEN
        ALTER TABLE public.ai_governance_logs ADD COLUMN pedagogy_score NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_governance_logs' AND column_name='reasoning_score') THEN
        ALTER TABLE public.ai_governance_logs ADD COLUMN reasoning_score NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_governance_logs' AND column_name='cognitive_alignment_score') THEN
        ALTER TABLE public.ai_governance_logs ADD COLUMN cognitive_alignment_score NUMERIC;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_governance_logs' AND column_name='retention_support_score') THEN
        ALTER TABLE public.ai_governance_logs ADD COLUMN retention_support_score NUMERIC;
    END IF;
END $$;

-- Create ai_routing_decisions table if not exists
CREATE TABLE IF NOT EXISTS public.ai_routing_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    task_type TEXT,
    cognitive_state TEXT,
    requested_model TEXT,
    selected_model TEXT,
    routing_reason TEXT,
    latency_ms INTEGER,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.ai_routing_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own routing decisions" ON public.ai_routing_decisions
    FOR SELECT USING (auth.uid() = user_id);
