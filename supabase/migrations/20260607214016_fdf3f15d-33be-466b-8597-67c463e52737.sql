-- Tabela de Coortes Pedagógicas
CREATE TABLE public.pedagogical_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    cohort_type TEXT NOT NULL CHECK (cohort_type IN ('control', 'experimental')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.pedagogical_cohorts TO authenticated;
GRANT ALL ON public.pedagogical_cohorts TO service_role;
ALTER TABLE public.pedagogical_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own cohort" ON public.pedagogical_cohorts FOR SELECT USING (auth.uid() = user_id);

-- Snapshot de Baseline
CREATE TABLE public.pedagogical_baseline_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    initial_theta NUMERIC,
    initial_accuracy NUMERIC,
    competencies_mastered INTEGER DEFAULT 0,
    competencies_deficit INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.pedagogical_baseline_snapshots TO authenticated;
GRANT ALL ON public.pedagogical_baseline_snapshots TO service_role;
ALTER TABLE public.pedagogical_baseline_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own baseline" ON public.pedagogical_baseline_snapshots FOR SELECT USING (auth.uid() = user_id);

-- Eventos de Aprendizagem (Recuperação e Erros)
CREATE TABLE public.pedagogical_learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    question_id UUID,
    competency_id UUID,
    event_type TEXT NOT NULL, -- 'error', 'recovery', 'retention_check', 'transfer_check'
    outcome TEXT, -- 'correct', 'incorrect'
    feature_used TEXT, -- 'tutor_v3', 'recovery', 'hospital_virtual', 'fsrs'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT ON public.pedagogical_learning_events TO authenticated;
GRANT ALL ON public.pedagogical_learning_events TO service_role;
ALTER TABLE public.pedagogical_learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own learning events" ON public.pedagogical_learning_events FOR SELECT USING (auth.uid() = user_id);

-- Resultados de Certificação (LES e Cohen's d)
CREATE TABLE public.pedagogical_certification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wave_id INTEGER,
    les_score NUMERIC NOT NULL,
    cohens_d NUMERIC,
    learning_yield NUMERIC,
    retention_experimental NUMERIC,
    retention_control NUMERIC,
    transfer_experimental NUMERIC,
    transfer_control NUMERIC,
    audit_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    raw_metrics JSONB DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.pedagogical_certification_results TO authenticated;
GRANT ALL ON public.pedagogical_certification_results TO service_role;
ALTER TABLE public.pedagogical_certification_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view certification results" ON public.pedagogical_certification_results FOR SELECT TO authenticated USING (true);
