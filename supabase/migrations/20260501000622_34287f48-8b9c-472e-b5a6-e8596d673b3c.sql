UPDATE public.system_flags
SET enabled = true, updated_at = now()
WHERE flag_key IN (
  'adaptive_video_enabled',
  'smart_replay_enabled',
  'tutor_temporal_enabled',
  'multimodal_analytics_enabled'
);

INSERT INTO public.system_flag_audit (flag_key, previous_value, new_value, changed_by, reason)
SELECT flag_key, false, true, NULL, 'Ativação Fase 2.1 — teste end-to-end (Tutor Temporal + Smart Replay + Drill-down)'
FROM public.system_flags
WHERE flag_key IN (
  'adaptive_video_enabled',
  'smart_replay_enabled',
  'tutor_temporal_enabled',
  'multimodal_analytics_enabled'
);