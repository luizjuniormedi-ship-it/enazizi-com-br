-- Allow authenticated users to insert pipeline events
CREATE POLICY "Allow authenticated insert for pipeline events" 
ON public.cme_pipeline_events 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update pipeline events (for progress updates if needed)
CREATE POLICY "Allow authenticated update for pipeline events" 
ON public.cme_pipeline_events 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Ensure scene graphs can be managed by authenticated users
CREATE POLICY "Allow authenticated manage scene graphs" 
ON public.cme_scene_graphs 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Ensure scene graph nodes can be managed by authenticated users
DROP POLICY IF EXISTS "Admins manage factory nodes" ON public.cme_scene_graph_nodes;
CREATE POLICY "Allow authenticated manage scene graph nodes" 
ON public.cme_scene_graph_nodes 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Ensure audit logs can be inserted
CREATE POLICY "Allow authenticated insert for audit logs" 
ON public.cme_audit_logs 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Fix render jobs policies if restrictive
DROP POLICY IF EXISTS "Workers can manage assigned render jobs" ON public.cme_render_jobs;
CREATE POLICY "Allow authenticated manage render jobs" 
ON public.cme_render_jobs 
FOR ALL 
USING (auth.role() = 'authenticated');

-- Grant permissions to public/authenticated roles if missing
GRANT ALL ON public.cme_pipeline_events TO authenticated;
GRANT ALL ON public.cme_scene_graphs TO authenticated;
GRANT ALL ON public.cme_scene_graph_nodes TO authenticated;
GRANT ALL ON public.cme_render_jobs TO authenticated;
GRANT ALL ON public.cme_audit_logs TO authenticated;
