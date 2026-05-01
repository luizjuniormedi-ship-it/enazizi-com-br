INSERT INTO public.system_flags (flag_key, enabled, description, category, rollout_mode)
VALUES ('circadian_intelligence_enabled', false, 'Habilita orquestração de sessões baseada em ritmos circadianos e padrões longitudinais.', 'adaptive', 'admins_only')
ON CONFLICT (flag_key) DO NOTHING;
