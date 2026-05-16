-- Create pipeline_governance table
CREATE TABLE IF NOT EXISTS public.pipeline_governance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID, -- Optional link to pipeline_jobs
    pipeline_name TEXT NOT NULL,
    function_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    model_used TEXT,
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER,
    error_stack TEXT,
    failure_reason TEXT,
    quality_score FLOAT,
    user_id UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_governance ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage pipeline_governance" 
ON public.pipeline_governance 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create pipeline_health_metrics table
CREATE TABLE IF NOT EXISTS public.pipeline_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_name TEXT NOT NULL UNIQUE,
    completion_rate FLOAT DEFAULT 1.0,
    avg_latency_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_health_check TIMESTAMP WITH TIME ZONE DEFAULT now(),
    health_status TEXT DEFAULT 'healthy', -- healthy, degraded, unstable, critical
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pipeline_health_metrics" 
ON public.pipeline_health_metrics 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- View for read-only access to health (everyone authenticated)
CREATE POLICY "Authenticated users can view health metrics" 
ON public.pipeline_health_metrics 
FOR SELECT 
TO authenticated 
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_pipeline_governance_updated_at
BEFORE UPDATE ON public.pipeline_governance
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_health_metrics_updated_at
BEFORE UPDATE ON public.pipeline_health_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
