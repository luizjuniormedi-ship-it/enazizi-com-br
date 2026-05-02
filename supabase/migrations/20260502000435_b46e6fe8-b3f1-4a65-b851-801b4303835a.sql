-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cme_lineage_nodes_entity ON public.cme_lineage_nodes(entity_id);
CREATE INDEX IF NOT EXISTS idx_cme_lineage_nodes_type ON public.cme_lineage_nodes(type);
CREATE INDEX IF NOT EXISTS idx_cme_lineage_edges_source ON public.cme_lineage_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_cme_lineage_edges_target ON public.cme_lineage_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_cme_video_projects_user ON public.cme_video_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_cme_render_jobs_project ON public.cme_render_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_cme_render_jobs_user ON public.cme_render_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_cme_scene_graphs_project ON public.cme_scene_graphs(video_project_id);
CREATE INDEX IF NOT EXISTS idx_cme_scene_graph_nodes_graph ON public.cme_scene_graph_nodes(scene_graph_id);

-- RLS Auditing Function
CREATE OR REPLACE FUNCTION public.cme_audit_rls_violation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.cme_audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    auth.uid(),
    'RLS_VIOLATION_ATTEMPT',
    TG_TABLE_NAME,
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END),
    jsonb_build_object('operation', TG_OP, 'timestamp', now())
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automated Cost Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_cme_job_costs()
RETURNS TRIGGER AS $$
DECLARE
  base_cost_per_min FLOAT := 0.50; -- Example: $0.50 per GPU minute
  gpu_duration FLOAT;
  total_cost FLOAT;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Calculate duration in minutes
    gpu_duration := EXTRACT(EPOCH FROM (NEW.updated_at - NEW.created_at)) / 60.0;
    total_cost := gpu_duration * base_cost_per_min;

    INSERT INTO public.cme_render_costs (
      render_job_id,
      project_id,
      user_id,
      gpu_minutes,
      cost_usd,
      metadata
    ) VALUES (
      NEW.id,
      NEW.project_id,
      NEW.user_id,
      gpu_duration,
      total_cost,
      jsonb_build_object('calculated_at', now(), 'strategy', 'v1_standard')
    );
    
    -- Update GPU metrics
    INSERT INTO public.cme_gpu_cost_metrics (
      worker_id,
      cost_usd,
      metrics_data
    ) VALUES (
      NEW.worker_id,
      total_cost,
      jsonb_build_object('job_id', NEW.id, 'duration_min', gpu_duration)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
DROP TRIGGER IF EXISTS tr_cme_calculate_costs ON public.cme_render_jobs;
CREATE TRIGGER tr_cme_calculate_costs
AFTER UPDATE ON public.cme_render_jobs
FOR EACH ROW
EXECUTE FUNCTION public.calculate_cme_job_costs();

-- RLS Policies Reinforcement
ALTER TABLE public.cme_video_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own projects" ON public.cme_video_projects;
CREATE POLICY "Users can view own projects" ON public.cme_video_projects
FOR SELECT USING (auth.uid() = user_id OR (SELECT (auth.jwt() ->> 'role')::text = 'admin'));

DROP POLICY IF EXISTS "Users can create own projects" ON public.cme_video_projects;
CREATE POLICY "Users can create own projects" ON public.cme_video_projects
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ENAFLIX Incident Log Table (if missing standard fields or ensuring exists)
CREATE TABLE IF NOT EXISTS public.cme_system_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL DEFAULT 'error',
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
