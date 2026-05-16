-- Create edge_execution_logs if not exists
CREATE TABLE IF NOT EXISTS public.edge_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT NOT NULL,
    request_id TEXT,
    correlation_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    method TEXT,
    status_code INTEGER,
    latency_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create runtime_incidents for self-healing
CREATE TABLE IF NOT EXISTS public.runtime_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warn', 'error', 'critical')),
    stage TEXT,
    message TEXT NOT NULL,
    stack_trace TEXT,
    correlation_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create pipeline_tracker for background jobs
CREATE TABLE IF NOT EXISTS public.pipeline_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_name TEXT NOT NULL,
    correlation_id TEXT UNIQUE,
    status TEXT CHECK (status IN ('queued', 'running', 'processing', 'retrying', 'completed', 'failed', 'timeout', 'orphaned', 'partial_failure')),
    total_steps INTEGER DEFAULT 0,
    completed_steps INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.edge_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_tracker ENABLE ROW LEVEL SECURITY;

-- Policies (Admin only for governance)
CREATE POLICY "Admins can view edge logs" ON public.edge_execution_logs FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can view incidents" ON public.runtime_incidents FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can view pipeline tracker" ON public.pipeline_tracker FOR SELECT USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Function to update pipeline_health_metrics
CREATE OR REPLACE FUNCTION public.update_pipeline_health_v2()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.pipeline_health_metrics (
        pipeline_name, 
        success_count, 
        error_count, 
        avg_latency_ms,
        last_health_check,
        health_status
    )
    VALUES (
        NEW.function_name,
        CASE WHEN NEW.status_code < 400 THEN 1 ELSE 0 END,
        CASE WHEN NEW.status_code >= 400 THEN 1 ELSE 0 END,
        NEW.latency_ms,
        now(),
        CASE WHEN NEW.status_code < 400 THEN 'healthy' ELSE 'degraded' END
    )
    ON CONFLICT (pipeline_name) DO UPDATE SET
        success_count = public.pipeline_health_metrics.success_count + EXCLUDED.success_count,
        error_count = public.pipeline_health_metrics.error_count + EXCLUDED.error_count,
        avg_latency_ms = (public.pipeline_health_metrics.avg_latency_ms + EXCLUDED.avg_latency_ms) / 2,
        last_health_check = now(),
        health_status = CASE 
            WHEN (public.pipeline_health_metrics.error_count + EXCLUDED.error_count) > 10 THEN 'critical'
            WHEN (public.pipeline_health_metrics.error_count + EXCLUDED.error_count) > 5 THEN 'degraded'
            ELSE 'healthy' 
        END,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for health metrics
DROP TRIGGER IF EXISTS tr_update_edge_health ON public.edge_execution_logs;
CREATE TRIGGER tr_update_edge_health
AFTER INSERT ON public.edge_execution_logs
FOR EACH ROW EXECUTE FUNCTION public.update_pipeline_health_v2();
