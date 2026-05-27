
-- 1. ai_content_audit_logs: restrict insert to admin/service_role
DROP POLICY IF EXISTS auth_insert_audit_logs ON public.ai_content_audit_logs;
DROP POLICY IF EXISTS "Admins and professors can view audit logs" ON public.ai_content_audit_logs;
CREATE POLICY admin_insert_audit_logs ON public.ai_content_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. cme_autonomous_optimizations
DROP POLICY IF EXISTS "Admins manage optimizations" ON public.cme_autonomous_optimizations;
CREATE POLICY "Admins manage optimizations" ON public.cme_autonomous_optimizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. cme_scene_graphs: remove public/anon access and switch admin policies to has_role
DROP POLICY IF EXISTS "Workers can read scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Admins have full access to scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users can insert their own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users can update their own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users can view their own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS admin_all_scene_graphs ON public.cme_scene_graphs;
CREATE POLICY admin_all_scene_graphs ON public.cme_scene_graphs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. cme_scene_graph_nodes admin policy -> has_role
DROP POLICY IF EXISTS admin_all_scene_nodes ON public.cme_scene_graph_nodes;
CREATE POLICY admin_all_scene_nodes ON public.cme_scene_graph_nodes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. governance_logs: only service_role can insert
DROP POLICY IF EXISTS auth_insert_governance_logs ON public.governance_logs;
CREATE POLICY service_insert_governance_logs ON public.governance_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 6. governance_queues -> has_role
DROP POLICY IF EXISTS "Enable read for admins" ON public.governance_queues;
CREATE POLICY "Enable read for admins" ON public.governance_queues
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. cme_gpu_clusters
DROP POLICY IF EXISTS "Staff can view GPU fleet" ON public.cme_gpu_clusters;
DROP POLICY IF EXISTS "Admins can manage GPU fleet" ON public.cme_gpu_clusters;
CREATE POLICY admin_manage_gpu_clusters ON public.cme_gpu_clusters
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 8. cme_cost_centers -> has_role
DROP POLICY IF EXISTS "Admins can manage costs" ON public.cme_cost_centers;
CREATE POLICY admin_manage_cost_centers ON public.cme_cost_centers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 9. governance_thresholds -> has_role
DROP POLICY IF EXISTS "Admins can manage governance thresholds" ON public.governance_thresholds;
CREATE POLICY admin_manage_governance_thresholds ON public.governance_thresholds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 10. incident_alerts -> has_role
DROP POLICY IF EXISTS "Admins can manage alerts" ON public.incident_alerts;
CREATE POLICY admin_manage_incident_alerts ON public.incident_alerts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 11. rag_chunks / rag_embeddings: restrict service_role policies to service_role only
DROP POLICY IF EXISTS "Service role can do everything on rag_chunks" ON public.rag_chunks;
CREATE POLICY "Service role can do everything on rag_chunks" ON public.rag_chunks
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can do everything on rag_embeddings" ON public.rag_embeddings;
CREATE POLICY "Service role can do everything on rag_embeddings" ON public.rag_embeddings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 12. Security definer view fix
ALTER VIEW public.v_enrichment_progress SET (security_invoker = true);
