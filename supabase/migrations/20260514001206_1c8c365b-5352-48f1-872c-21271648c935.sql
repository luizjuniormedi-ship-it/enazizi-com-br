-- Phase 4: Question Lifecycle
ALTER TABLE public.questions_bank 
ADD COLUMN IF NOT EXISTS lifecycle_state TEXT DEFAULT 'generated',
ADD COLUMN IF NOT EXISTS embedding_hash TEXT,
ADD COLUMN IF NOT EXISTS batch_id UUID,
ADD COLUMN IF NOT EXISTS cost_tokens INTEGER,
ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 6);

-- Create index for lifecycle states
CREATE INDEX IF NOT EXISTS idx_questions_bank_lifecycle ON public.questions_bank(lifecycle_state);
CREATE INDEX IF NOT EXISTS idx_questions_bank_batch ON public.questions_bank(batch_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank_embedding_hash ON public.questions_bank(embedding_hash);

-- Phase 2: Cost Governance
CREATE TABLE IF NOT EXISTS public.ai_cost_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name TEXT NOT NULL, -- 'question_gen', 'tutor', 'planner', etc.
    model_name TEXT NOT NULL,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd NUMERIC(12, 8) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.ai_cost_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users" ON public.ai_cost_metrics FOR SELECT TO authenticated USING (true);

-- Phase 1 & 5: Governance Queues
CREATE TABLE IF NOT EXISTS public.governance_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    queue_type TEXT NOT NULL, -- 'progressive', 'retry', 'failed', 'quarantine', 'revalidation'
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    priority INTEGER DEFAULT 0,
    payload JSONB,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.governance_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service role" ON public.governance_queues FOR ALL TO service_role USING (true);
CREATE POLICY "Enable read for admins" ON public.governance_queues FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Phase 6: Telemetry Compression
CREATE TABLE IF NOT EXISTS public.telemetry_aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name TEXT NOT NULL,
    dimension_name TEXT, -- 'user', 'topic', 'model'
    dimension_value TEXT,
    aggregate_type TEXT, -- 'hourly', 'daily'
    sum_value NUMERIC,
    avg_value NUMERIC,
    count_value INTEGER,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.telemetry_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated" ON public.telemetry_aggregates FOR SELECT TO authenticated USING (true);

-- Phase 9: Human Audit Mode
CREATE TABLE IF NOT EXISTS public.human_audit_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions_bank(id) ON DELETE CASCADE,
    audit_reason TEXT, -- 'random', 'high_risk', 'divergence'
    status TEXT DEFAULT 'pending', -- 'pending', 'audited', 'rejected'
    auditor_id UUID REFERENCES auth.users(id),
    audit_notes TEXT,
    divergence_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.human_audit_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read/write for admins" ON public.human_audit_queue FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Phase 5: Cognitive Load Balancer Tracking
CREATE TABLE IF NOT EXISTS public.topic_distribution_stats (
    topic TEXT PRIMARY KEY,
    question_count INTEGER DEFAULT 0,
    last_generated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.topic_distribution_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all" ON public.topic_distribution_stats FOR SELECT TO authenticated USING (true);
