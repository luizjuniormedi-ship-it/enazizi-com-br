-- Sprint de Correção: alinhar flags do Radar com a UI já visível
-- O Radar UI (radar_trajetoria_enabled=true) está exposto, mas engine/apply/explain
-- estavam desligados, gerando "visível porém quebrado". Igualando ao default do código.
UPDATE public.system_flags
SET enabled = true,
    rollout_mode = 'admins_only',
    updated_at = now()
WHERE flag_key IN (
  'trajectory_engine_v1_enabled',
  'trajectory_apply_v1_enabled',
  'trajectory_explain_v1_enabled'
);