INSERT INTO system_flags (flag_key, enabled, description, category, rollout_mode) VALUES
  ('mission_control_enabled', false, 'Habilita a MissionControlPage como cockpit principal de estudo', 'ux', 'global'),
  ('study_loop_enabled', false, 'Habilita o Study Loop dentro da MissionControlPage', 'ux', 'global'),
  ('product_metrics_enabled', true, 'Habilita o dashboard de métricas em /admin/metrics', 'admin', 'global')
ON CONFLICT DO NOTHING;