-- ════════════════════════════════════════════════════════════════════════════
-- RADAR DE TRAJETÓRIA IA — Migração inicial (v1)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.tg_trajectory_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1) trajectory_runs
CREATE TABLE public.trajectory_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  engine_version TEXT NOT NULL DEFAULT 'v1',
  duration_ms INTEGER,
  error_message TEXT,
  trigger_source TEXT,
  snapshot_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajectory_runs_user_created ON public.trajectory_runs (user_id, created_at DESC);
ALTER TABLE public.trajectory_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own trajectory runs" ON public.trajectory_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own trajectory runs" ON public.trajectory_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own trajectory runs" ON public.trajectory_runs FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_trajectory_runs_updated_at BEFORE UPDATE ON public.trajectory_runs FOR EACH ROW EXECUTE FUNCTION public.tg_trajectory_set_updated_at();

-- 2) trajectory_snapshots
CREATE TABLE public.trajectory_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  run_id UUID REFERENCES public.trajectory_runs(id) ON DELETE SET NULL,
  questions_last_7d INTEGER NOT NULL DEFAULT 0,
  questions_last_28d INTEGER NOT NULL DEFAULT 0,
  active_days_last_14d INTEGER NOT NULL DEFAULT 0,
  fsrs_due_count INTEGER NOT NULL DEFAULT 0,
  fsrs_overdue_count INTEGER NOT NULL DEFAULT 0,
  error_bank_open_count INTEGER NOT NULL DEFAULT 0,
  simulado_count_last_28d INTEGER NOT NULL DEFAULT 0,
  accuracy_last_28d NUMERIC(5,2),
  retention_proxy NUMERIC(5,2),
  exam_proximity_days INTEGER,
  consistency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  retention_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  execution_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  backlog_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  data_completeness TEXT NOT NULL DEFAULT 'partial',
  raw_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajectory_snapshots_user_created ON public.trajectory_snapshots (user_id, created_at DESC);
ALTER TABLE public.trajectory_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own snapshots" ON public.trajectory_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own snapshots" ON public.trajectory_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_trajectory_snapshots_updated_at BEFORE UPDATE ON public.trajectory_snapshots FOR EACH ROW EXECUTE FUNCTION public.tg_trajectory_set_updated_at();

ALTER TABLE public.trajectory_runs ADD CONSTRAINT fk_trajectory_runs_snapshot FOREIGN KEY (snapshot_id) REFERENCES public.trajectory_snapshots(id) ON DELETE SET NULL;

-- 3) trajectory_scenarios
CREATE TABLE public.trajectory_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES public.trajectory_snapshots(id) ON DELETE CASCADE,
  scenario_type TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,
  projected_consistency NUMERIC(5,2) NOT NULL DEFAULT 0,
  projected_retention NUMERIC(5,2) NOT NULL DEFAULT 0,
  projected_execution NUMERIC(5,2) NOT NULL DEFAULT 0,
  projected_backlog NUMERIC(5,2) NOT NULL DEFAULT 0,
  projected_overall NUMERIC(5,2) NOT NULL DEFAULT 0,
  delta_overall NUMERIC(6,2) NOT NULL DEFAULT 0,
  cost_intensity NUMERIC(4,2) NOT NULL DEFAULT 0,
  retention_risk NUMERIC(4,2) NOT NULL DEFAULT 0,
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajectory_scenarios_snapshot ON public.trajectory_scenarios (snapshot_id, scenario_type, horizon_days);
CREATE INDEX idx_trajectory_scenarios_user ON public.trajectory_scenarios (user_id, created_at DESC);
ALTER TABLE public.trajectory_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own scenarios" ON public.trajectory_scenarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scenarios" ON public.trajectory_scenarios FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4) trajectory_risk_factors
CREATE TABLE public.trajectory_risk_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES public.trajectory_snapshots(id) ON DELETE CASCADE,
  risk_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  impact_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajectory_risks_snapshot ON public.trajectory_risk_factors (snapshot_id, impact_score DESC);
ALTER TABLE public.trajectory_risk_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own risks" ON public.trajectory_risk_factors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own risks" ON public.trajectory_risk_factors FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5) trajectory_opportunities
CREATE TABLE public.trajectory_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES public.trajectory_snapshots(id) ON DELETE CASCADE,
  opportunity_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  potential_gain NUMERIC(5,2) NOT NULL DEFAULT 0,
  effort_level TEXT NOT NULL DEFAULT 'medium',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajectory_opps_snapshot ON public.trajectory_opportunities (snapshot_id, potential_gain DESC);
ALTER TABLE public.trajectory_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own opportunities" ON public.trajectory_opportunities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own opportunities" ON public.trajectory_opportunities FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6) trajectory_recommendations
CREATE TABLE public.trajectory_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES public.trajectory_snapshots(id) ON DELETE CASCADE,
  recommendation_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  orchestrator_action TEXT NOT NULL,
  target_module TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_impact NUMERIC(5,2) NOT NULL DEFAULT 0,
  effort_level TEXT NOT NULL DEFAULT 'medium',
  priority INTEGER NOT NULL DEFAULT 50,
  rationale TEXT,
  badges TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajectory_recs_snapshot ON public.trajectory_recommendations (snapshot_id, priority DESC);
ALTER TABLE public.trajectory_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recommendations" ON public.trajectory_recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recommendations" ON public.trajectory_recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7) trajectory_applied_actions
CREATE TABLE public.trajectory_applied_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  snapshot_id UUID REFERENCES public.trajectory_snapshots(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES public.trajectory_recommendations(id) ON DELETE SET NULL,
  decision_id UUID,
  orchestrator_action TEXT,
  target_module TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  outcome JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trajectory_applied_user_created ON public.trajectory_applied_actions (user_id, created_at DESC);
ALTER TABLE public.trajectory_applied_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own applied actions" ON public.trajectory_applied_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own applied actions" ON public.trajectory_applied_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own applied actions" ON public.trajectory_applied_actions FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_trajectory_applied_updated_at BEFORE UPDATE ON public.trajectory_applied_actions FOR EACH ROW EXECUTE FUNCTION public.tg_trajectory_set_updated_at();

-- Feature flags (todas OFF, visíveis a admins)
INSERT INTO public.system_flags (flag_key, enabled, description, category, rollout_mode)
VALUES
  ('radar_trajetoria_enabled', false, 'Liga o módulo Radar de Trajetória IA', 'radar', 'admins_only'),
  ('trajectory_engine_v1_enabled', false, 'Permite execução do motor v1 (snapshot+cenários)', 'radar', 'admins_only'),
  ('trajectory_apply_v1_enabled', false, 'Permite aplicar recomendações ao orquestrador', 'radar', 'admins_only'),
  ('trajectory_explain_v1_enabled', false, 'Permite gerar explicação narrativa via IA', 'radar', 'admins_only')
ON CONFLICT (flag_key) DO NOTHING;