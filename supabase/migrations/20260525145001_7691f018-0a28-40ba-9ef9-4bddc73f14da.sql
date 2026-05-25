
-- 1. notification_queue: scope writes
DROP POLICY IF EXISTS "Sistema pode gerenciar notificações" ON public.notification_queue;
CREATE POLICY "Service role can manage notifications"
  ON public.notification_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Users can insert their own notifications"
  ON public.notification_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications"
  ON public.notification_queue FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications"
  ON public.notification_queue FOR DELETE
  USING (auth.uid() = user_id);

-- 2. cognitive_runtime_events: restrict insert
DROP POLICY IF EXISTS "System can insert cognitive events" ON public.cognitive_runtime_events;
CREATE POLICY "Owner or service can insert cognitive events"
  ON public.cognitive_runtime_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

-- 3. pipeline_stress_logs: lock down
DROP POLICY IF EXISTS "Admin full access pipeline_stress" ON public.pipeline_stress_logs;
CREATE POLICY "Admins can read pipeline_stress_logs"
  ON public.pipeline_stress_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Service role manages pipeline_stress_logs"
  ON public.pipeline_stress_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. raw_user_meta_data -> has_role()
DROP POLICY IF EXISTS "Admins can view and update health status" ON public.multimodal_health_status;
CREATE POLICY "Admins can manage health status"
  ON public.multimodal_health_status FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins and auditors can view audit logs" ON public.multimodal_audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.multimodal_audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage checklist runs" ON public.system_checklist_runs;
CREATE POLICY "Admins can manage checklist runs"
  ON public.system_checklist_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage knowledge graph" ON public.knowledge_nodes;
CREATE POLICY "Admins can manage knowledge graph"
  ON public.knowledge_nodes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage knowledge edges" ON public.knowledge_edges;
CREATE POLICY "Admins can manage knowledge edges"
  ON public.knowledge_edges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. jwt role -> has_role()
DROP POLICY IF EXISTS "Admins full access" ON public.cme_session_aggregations;
CREATE POLICY "Admins full access"
  ON public.cme_session_aggregations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins have full access to scores" ON public.medical_content_scores;
CREATE POLICY "Admins have full access to scores"
  ON public.medical_content_scores FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Professors can manage pedagogical scores" ON public.medical_content_scores;
CREATE POLICY "Professors can manage pedagogical scores"
  ON public.medical_content_scores FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role));
DROP POLICY IF EXISTS "Specialists can manage scientific scores" ON public.medical_content_scores;
DROP POLICY IF EXISTS "Strict isolation for medical scores" ON public.medical_content_scores;
CREATE POLICY "Strict isolation for medical scores"
  ON public.medical_content_scores FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role));

DROP POLICY IF EXISTS "Admins have full access to logs" ON public.governance_audit_logs;
CREATE POLICY "Admins have full access to logs"
  ON public.governance_audit_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can view all logs" ON public.governance_audit_logs;
CREATE POLICY "Admins can view all logs"
  ON public.governance_audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users can view logs for content they are related to" ON public.governance_audit_logs;
CREATE POLICY "Staff can view related content logs"
  ON public.governance_audit_logs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'professor'::app_role)
  );

DROP POLICY IF EXISTS "Admins can manage attention maps" ON public.cme_attention_maps;
CREATE POLICY "Admins can manage attention maps"
  ON public.cme_attention_maps FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage overlay clusters" ON public.cme_overlay_clusters;
CREATE POLICY "Admins can manage overlay clusters"
  ON public.cme_overlay_clusters FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage scene transitions" ON public.cme_scene_transitions;
CREATE POLICY "Admins can manage scene transitions"
  ON public.cme_scene_transitions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage retention" ON public.data_retention_policies;
CREATE POLICY "Admins can manage retention"
  ON public.data_retention_policies FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage digests" ON public.operational_digests;
CREATE POLICY "Admins can manage digests"
  ON public.operational_digests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage playbooks" ON public.operational_playbooks;
CREATE POLICY "Admins can manage playbooks"
  ON public.operational_playbooks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage mitigation" ON public.auto_mitigation_logs;
CREATE POLICY "Admins can manage mitigation"
  ON public.auto_mitigation_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage correlations" ON public.incident_correlations;
CREATE POLICY "Admins can manage correlations"
  ON public.incident_correlations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage lineage" ON public.cme_render_lineage;
CREATE POLICY "Admins can manage lineage"
  ON public.cme_render_lineage FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage quality reviews" ON public.cme_quality_reviews;
CREATE POLICY "Admins can manage quality reviews"
  ON public.cme_quality_reviews FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'professor'::app_role));
DROP POLICY IF EXISTS "Coordinators manage reviews" ON public.cme_quality_reviews;
CREATE POLICY "Coordinators manage reviews"
  ON public.cme_quality_reviews FOR ALL
  USING (public.has_role(auth.uid(), 'coordinator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'coordinator'::app_role));

DROP POLICY IF EXISTS "Admins can manage incidents" ON public.admin_incidents;
CREATE POLICY "Admins can manage incidents"
  ON public.admin_incidents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
