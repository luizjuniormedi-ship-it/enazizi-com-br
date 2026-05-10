-- Table for QA Runs
CREATE TABLE public.tutor_qa_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    pedagogical_score NUMERIC,
    ia_runtime_score NUMERIC,
    ux_score NUMERIC,
    stability_score NUMERIC,
    security_score NUMERIC,
    performance_score NUMERIC,
    global_score NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb,
    triggered_by UUID REFERENCES auth.users(id)
);

-- Table for Individual QA Test Results
CREATE TABLE public.tutor_qa_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.tutor_qa_runs(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'pedagogical', 'ia_runtime', 'ui', 'event', 'regression', 'performance', 'security'
    test_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
    score NUMERIC,
    details TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    latency_ms INTEGER,
    model_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for Snapshots (Regression check)
CREATE TABLE public.tutor_qa_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES public.tutor_qa_runs(id) ON DELETE CASCADE,
    scenario_key TEXT NOT NULL,
    snapshot_type TEXT NOT NULL, -- 'content', 'metadata', 'state'
    content_hash TEXT,
    content_raw TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_qa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_qa_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_qa_snapshots ENABLE ROW LEVEL SECURITY;

-- Simple Admin Check Function (if not exists)
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(raw_user_meta_data->>'role' = 'admin', false)
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies
CREATE POLICY "Admins can view QA runs" ON public.tutor_qa_runs FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert QA runs" ON public.tutor_qa_runs FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update QA runs" ON public.tutor_qa_runs FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can view QA results" ON public.tutor_qa_results FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert QA results" ON public.tutor_qa_results FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can view QA snapshots" ON public.tutor_qa_snapshots FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert QA snapshots" ON public.tutor_qa_snapshots FOR INSERT WITH CHECK (public.is_admin());
