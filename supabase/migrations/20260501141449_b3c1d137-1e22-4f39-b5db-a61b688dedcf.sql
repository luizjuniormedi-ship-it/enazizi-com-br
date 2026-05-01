UPDATE public.system_flags
SET enabled = true, updated_at = now()
WHERE flag_key IN (
  'adaptive_decisions_enabled',
  'preventive_tutor_enabled'
);

INSERT INTO public.system_flag_audit (flag_key, previous_value, new_value, changed_by, reason)
SELECT flag_key, false, true, NULL, 'Início da Fase 3 — Modo Shadow e Tutor Preventivo'
FROM public.system_flags
WHERE flag_key IN (
  'adaptive_decisions_enabled',
  'preventive_tutor_enabled'
);