
INSERT INTO public.system_flags (flag_key, enabled, description, category, rollout_mode)
VALUES
  ('shadow_adaptive_enabled', false, 'Master switch da Shadow Adaptive Layer (Fase 3A). OFF em prod. Quando OFF, nenhum evento/decisão shadow é emitido.', 'shadow-adaptive', 'admins_only'),
  ('unified_events_enabled', false, 'Permite emissão de eventos unificados shadow (ENAFLIX, Tutor, Simulados, Flashcards, Mnemônico, Planner). Requer shadow_adaptive_enabled.', 'shadow-adaptive', 'admins_only'),
  ('shadow_decisions_enabled', false, 'Permite gravar decisões adaptativas simuladas em assistant_decisions (source_module=shadow-adaptive-v1). Não aplica nada na UX.', 'shadow-adaptive', 'admins_only'),
  ('shadow_scores_enabled', false, 'Permite cálculo passivo de scores cognitivos (fadiga, retenção, abandono) gravados como outcome. Sem efeito no ranking real.', 'shadow-adaptive', 'admins_only')
ON CONFLICT (flag_key) DO NOTHING;
