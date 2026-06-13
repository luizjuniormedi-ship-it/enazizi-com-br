
-- ============================================================
-- EVNP Fase 1 — Alpha Cohort Tracking + Official Exam Outcomes
-- Guard-rails: sem correlação, sem effect size, sem dashboard nacional,
-- sem export, sem ranking, sem aprovação agregada.
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.alpha_snapshot_checkpoint AS ENUM ('d0','d30','d60','d90');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.exam_evidence_tier AS ENUM ('student_reported','document_verified','institution_verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- alpha_cohort_snapshots ----------------
CREATE TABLE IF NOT EXISTS public.alpha_cohort_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES public.academic_cohorts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkpoint public.alpha_snapshot_checkpoint NOT NULL,
  readiness NUMERIC,
  fsrs_due_count INTEGER,
  study_minutes_7d INTEGER,
  tutor_sessions_7d INTEGER,
  simulado_count INTEGER,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (cohort_id, user_id, checkpoint)
);

GRANT SELECT ON public.alpha_cohort_snapshots TO authenticated;
GRANT ALL ON public.alpha_cohort_snapshots TO service_role;

ALTER TABLE public.alpha_cohort_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own snapshots"
  ON public.alpha_cohort_snapshots FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all snapshots"
  ON public.alpha_cohort_snapshots FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_alpha_snapshots_cohort ON public.alpha_cohort_snapshots(cohort_id, checkpoint);
CREATE INDEX IF NOT EXISTS idx_alpha_snapshots_user ON public.alpha_cohort_snapshots(user_id);

-- ---------------- official_exam_outcomes ----------------
CREATE TABLE IF NOT EXISTS public.official_exam_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  exam_year INTEGER,
  score NUMERIC,
  approval BOOLEAN,
  rank_position INTEGER,
  institution TEXT,
  evidence_tier public.exam_evidence_tier NOT NULL DEFAULT 'student_reported',
  evidence_url TEXT,
  validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.official_exam_outcomes TO authenticated;
GRANT ALL ON public.official_exam_outcomes TO service_role;

ALTER TABLE public.official_exam_outcomes ENABLE ROW LEVEL SECURITY;

-- Aluno: vê e cria os próprios
CREATE POLICY "Users view own outcomes"
  ON public.official_exam_outcomes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own outcomes (always student_reported, not validated)"
  ON public.official_exam_outcomes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND evidence_tier = 'student_reported'
    AND validated = false
  );

-- Aluno: pode atualizar SÓ campos descritivos quando ainda não validado, sem mudar tier/validated
CREATE POLICY "Users edit own non-validated outcomes"
  ON public.official_exam_outcomes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND validated = false)
  WITH CHECK (
    auth.uid() = user_id
    AND validated = false
    AND evidence_tier = 'student_reported'
  );

-- Admin: vê tudo, promove tier, valida
CREATE POLICY "Admins view all outcomes"
  ON public.official_exam_outcomes FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins update all outcomes"
  ON public.official_exam_outcomes FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_outcomes_user ON public.official_exam_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_exam ON public.official_exam_outcomes(exam, exam_year);

-- updated_at trigger (reuse existing function if present)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_outcomes_updated_at ON public.official_exam_outcomes;
CREATE TRIGGER update_outcomes_updated_at
  BEFORE UPDATE ON public.official_exam_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------- Seed ALPHA_2026 ----------------
INSERT INTO public.academic_cohorts (name, description, target_exam, start_date, metadata)
VALUES (
  'ALPHA_2026',
  'Primeira coorte oficial de validação externa do ENAZIZI (EVNP Fase 1). Meta inicial: 50 alunos.',
  'ENAMED',
  CURRENT_DATE,
  '{"program":"EVNP","phase":"1","target_size":50,"status":"recruiting"}'::jsonb
)
ON CONFLICT (name) DO NOTHING;
