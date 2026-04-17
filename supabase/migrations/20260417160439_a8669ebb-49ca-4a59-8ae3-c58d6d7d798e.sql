-- Orchestrator V2 — memória de ações, cooldowns, fadiga, exploração,
-- perfil cognitivo e outcomes ampliados.

ALTER TABLE public.orchestrator_outcomes
  ADD COLUMN IF NOT EXISTS time_to_follow_seconds integer,
  ADD COLUMN IF NOT EXISTS retention_delta numeric,
  ADD COLUMN IF NOT EXISTS error_reduction numeric,
  ADD COLUMN IF NOT EXISTS modality text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS exploration boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orch_outcomes_modality
  ON public.orchestrator_outcomes(user_id, modality, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orch_outcomes_topic
  ON public.orchestrator_outcomes(user_id, topic, created_at DESC);

ALTER TABLE public.orchestrator_rule_weights
  ADD COLUMN IF NOT EXISTS cooldown_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'core';

INSERT INTO public.orchestrator_rule_weights
  (rule_id, rule_name, current_weight, baseline_weight, cooldown_minutes, category, notes)
VALUES
  ('R9',  'Repeticao excessiva (anti-loop)',     1.0, 1.0, 0, 'modulator',
   'penaliza acao que se repete demais nas ultimas 5 escolhas'),
  ('R10', 'Boost por efetividade individual',    1.0, 1.0, 0, 'modulator',
   'amplifica modalidades com maior improvement_delta historico'),
  ('R11', 'Fadiga cognitiva',                    1.0, 1.0, 0, 'modulator',
   'reduz peso de carga pesada quando fadiga alta'),
  ('R12', 'Exploracao controlada',               1.0, 1.0, 0, 'modulator',
   'epsilon-greedy 12% para evitar overfitting'),
  ('R13', 'Phase boost',                         1.0, 1.0, 0, 'modulator',
   'ajusta pesos pela fase de estudo (base/consolidacao/reta_final)')
ON CONFLICT (rule_id) DO UPDATE
SET cooldown_minutes = EXCLUDED.cooldown_minutes,
    category = EXCLUDED.category,
    rule_name = EXCLUDED.rule_name;

UPDATE public.orchestrator_rule_weights SET cooldown_minutes = 45   WHERE rule_id = 'R3' AND cooldown_minutes = 0;
UPDATE public.orchestrator_rule_weights SET cooldown_minutes = 60   WHERE rule_id = 'R4' AND cooldown_minutes = 0;
UPDATE public.orchestrator_rule_weights SET cooldown_minutes = 30   WHERE rule_id = 'R5' AND cooldown_minutes = 0;
UPDATE public.orchestrator_rule_weights SET cooldown_minutes = 1440 WHERE rule_id = 'R6' AND cooldown_minutes = 0;