-- 1. COGNITIVE ORCHESTRATOR TABLES
CREATE TABLE IF NOT EXISTS public.orchestrator_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'planner', 'tutor', 'fsrs', etc.
    decision_type TEXT NOT NULL, -- 'next_content', 'recovery_mode', 'skip_content'
    priority INTEGER DEFAULT 1,
    reasoning TEXT,
    input_snapshot JSONB,
    output_action JSONB,
    confidence NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cognitive_state_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fatigue_score NUMERIC,
    retention_score NUMERIC,
    overload_score NUMERIC,
    engagement_score NUMERIC,
    abandonment_risk NUMERIC,
    dominant_error_clusters JSONB,
    weak_specialties JSONB,
    fsrs_pressure NUMERIC,
    current_theta NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trigger_reason TEXT,
    action_type TEXT,
    generated_content JSONB,
    success BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. IRT (ITEM RESPONSE THEORY) TABLES
CREATE TABLE IF NOT EXISTS public.item_calibration_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    items_processed INTEGER DEFAULT 0,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.item_exposure_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions_bank(id) ON DELETE CASCADE,
    exposure_count INTEGER DEFAULT 0,
    target_exposure INTEGER DEFAULT 1000,
    last_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(question_id)
);

CREATE TABLE IF NOT EXISTS public.theta_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theta_value NUMERIC NOT NULL,
    standard_error NUMERIC,
    context_type TEXT, -- 'simulado', 'daily_study', 'exam'
    context_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.adaptive_testing_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active',
    initial_theta NUMERIC,
    final_theta NUMERIC,
    items_count INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. CME SUPPORTING TABLES
CREATE TABLE IF NOT EXISTS public.cme_render_workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_name TEXT NOT NULL,
    status TEXT DEFAULT 'offline', -- 'idle', 'busy', 'offline'
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT now(),
    capabilities JSONB,
    gpu_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cme_render_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES public.cme_render_workers(id),
    log_level TEXT DEFAULT 'info',
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. AI AGENTS LOGGING
CREATE TABLE IF NOT EXISTS public.ai_agents_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_name TEXT NOT NULL, -- 'Cognitive Supervisor', 'FSRS Supervisor', etc.
    action TEXT NOT NULL,
    confidence NUMERIC,
    decision_payload JSONB,
    trace_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. ENABLE RLS
ALTER TABLE public.orchestrator_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_state_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theta_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_testing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_exposure_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_calibration_jobs ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES
CREATE POLICY "Users can view their own orchestrator decisions" ON public.orchestrator_decisions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own cognitive snapshots" ON public.cognitive_state_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own recovery actions" ON public.recovery_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own theta history" ON public.theta_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own adaptive sessions" ON public.adaptive_testing_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own agent logs" ON public.ai_agents_logs FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (assuming role checks or service role)
CREATE POLICY "System can manage items" ON public.item_exposure_control FOR ALL USING (true);
CREATE POLICY "System can manage calibration" ON public.item_calibration_jobs FOR ALL USING (true);
CREATE POLICY "System can manage workers" ON public.cme_render_workers FOR ALL USING (true);
CREATE POLICY "System can manage cme logs" ON public.cme_render_logs FOR ALL USING (true);
