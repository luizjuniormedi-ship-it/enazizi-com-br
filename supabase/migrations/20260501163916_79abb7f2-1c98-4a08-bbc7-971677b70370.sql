-- Insert audit_mode_enabled flag if not exists
INSERT INTO public.system_flags (flag_key, enabled, description, category)
VALUES ('audit_mode_enabled', false, 'Habilita o registro detalhado de latência, payloads e decisões para auditoria multimodal.', 'multimodal')
ON CONFLICT (flag_key) DO NOTHING;

-- Create table for real-time module health indicators
CREATE TABLE IF NOT EXISTS public.multimodal_health_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'warning', 'critical')),
    last_check_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_error TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS for health status
ALTER TABLE public.multimodal_health_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view and update health status" 
ON public.multimodal_health_status 
FOR ALL 
USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.uid() = id AND (raw_user_meta_data->>'role' IN ('admin', 'auditor', 'coordinator'))));

-- Create table for detailed audit logs
CREATE TABLE IF NOT EXISTS public.multimodal_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    payload JSONB,
    response JSONB,
    latency_ms INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS for audit logs
ALTER TABLE public.multimodal_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and auditors can view audit logs" 
ON public.multimodal_audit_logs 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.uid() = id AND (raw_user_meta_data->>'role' IN ('admin', 'auditor', 'coordinator'))));

-- Create table for checklist runs
CREATE TABLE IF NOT EXISTS public.system_checklist_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL, -- 'smoke', 'full', 'publication'
    status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
    results JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS for checklist runs
ALTER TABLE public.system_checklist_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage checklist runs" 
ON public.system_checklist_runs 
FOR ALL 
USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.uid() = id AND (raw_user_meta_data->>'role' IN ('admin', 'auditor', 'coordinator'))));

-- Pre-fill health status for modules
INSERT INTO public.multimodal_health_status (module_name, status) VALUES
('Tutor IA', 'healthy'),
('NotebookLM', 'healthy'),
('Biblioteca de Videoaulas', 'healthy'),
('Smart Replay', 'healthy'),
('Heatmap Cognitivo', 'healthy'),
('Ingestion Network', 'healthy')
ON CONFLICT (module_name) DO NOTHING;

-- Function to update updated_at if needed or handle logs
CREATE OR REPLACE FUNCTION public.log_multimodal_audit(
    p_module TEXT,
    p_action TEXT,
    p_payload JSONB,
    p_response JSONB,
    p_latency_ms INTEGER,
    p_status TEXT,
    p_error TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_audit_enabled BOOLEAN;
BEGIN
    SELECT enabled INTO v_audit_enabled FROM public.system_flags WHERE flag_key = 'audit_mode_enabled';
    
    IF v_audit_enabled THEN
        INSERT INTO public.multimodal_audit_logs (module, action, payload, response, latency_ms, status, error_message, created_by)
        VALUES (p_module, p_action, p_payload, p_response, p_latency_ms, p_status, p_error, auth.uid());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
