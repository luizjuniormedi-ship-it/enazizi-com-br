-- Loop Segurança 3D — Hardening de banco (sem alterar features)
-- 1) Converte 6 views para security_invoker (caller é avaliado pela RLS, não o owner)
ALTER VIEW public.cme_session_aggregation_summary SET (security_invoker = true);
ALTER VIEW public.lesson_rating_stats           SET (security_invoker = true);
ALTER VIEW public.noc_metrics                   SET (security_invoker = true);
ALTER VIEW public.prompt_performance_analytics  SET (security_invoker = true);
ALTER VIEW public.tutor_health_metrics          SET (security_invoker = true);
ALTER VIEW public.v_time_to_action_summary      SET (security_invoker = true);

-- 2) Fixa search_path em 27 funções públicas (mitiga search_path mutable)
ALTER FUNCTION public.aggregate_cme_quality_to_project()                 SET search_path = public;
ALTER FUNCTION public.calculate_blueprint_health(p_exam_key text)        SET search_path = public;
ALTER FUNCTION public.calculate_cme_media_health_score(lesson_id uuid)   SET search_path = public;
ALTER FUNCTION public.check_cme_publication_readiness()                  SET search_path = public;
ALTER FUNCTION public.check_cognitive_recovery_mode()                    SET search_path = public;
ALTER FUNCTION public.check_system_health()                              SET search_path = public;
ALTER FUNCTION public.check_video_lesson_media_validity()                SET search_path = public;
ALTER FUNCTION public.ensure_adaptive_schedule_profile()                 SET search_path = public;
ALTER FUNCTION public.generate_intervention_explanation()                SET search_path = public;
ALTER FUNCTION public.get_active_blueprint(p_exam_key text)              SET search_path = public;
ALTER FUNCTION public.handle_updated_at()                                SET search_path = public;
ALTER FUNCTION public.increment_hallucination_count()                    SET search_path = public;
ALTER FUNCTION public.log_cme_status_change()                            SET search_path = public;
ALTER FUNCTION public.normalize_medical_topic(t text)                    SET search_path = public;
ALTER FUNCTION public.sync_cme_reference_status()                        SET search_path = public;
ALTER FUNCTION public.sync_cme_scene_graph_payload()                     SET search_path = public;
ALTER FUNCTION public.sync_cognitive_rhythm(p_user_id uuid)              SET search_path = public;
ALTER FUNCTION public.track_incident_from_error()                        SET search_path = public;
ALTER FUNCTION public.trig_update_topic_normalized()                     SET search_path = public;
ALTER FUNCTION public.trigger_cleanup_tutor_cache()                      SET search_path = public;
ALTER FUNCTION public.trigger_cme_operational_alert()                    SET search_path = public;
ALTER FUNCTION public.trigger_update_cme_health_score()                  SET search_path = public;
ALTER FUNCTION public.update_node_mastery_metrics()                      SET search_path = public;
ALTER FUNCTION public.update_notebooklm_updated_at()                     SET search_path = public;
ALTER FUNCTION public.update_rag_timestamp()                             SET search_path = public;
ALTER FUNCTION public.update_simulation_job_updated_at()                 SET search_path = public;
ALTER FUNCTION public.update_updated_at_column()                         SET search_path = public;