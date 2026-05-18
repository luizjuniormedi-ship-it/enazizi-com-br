-- 1. Tabela de Métricas de Desempenho (Mapa de Evolução)
CREATE TABLE IF NOT EXISTS public.performance_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    specialty TEXT NOT NULL,
    discipline TEXT,
    topic TEXT,
    accuracy_rate NUMERIC DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    fsrs_stability NUMERIC DEFAULT 0,
    mastery_level TEXT DEFAULT 'beginner',
    trend TEXT DEFAULT 'stable',
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela de Telemetria Pedagógica
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'login', 'study_start', 'abandonment', 'error_detected'
    module_key TEXT,
    payload JSONB DEFAULT '{}',
    duration_seconds INTEGER DEFAULT 0,
    cognitive_load_score NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Tabela de Predição de Aprovação
CREATE TABLE IF NOT EXISTS public.approval_predictions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    banca_target TEXT,
    probability_percent NUMERIC DEFAULT 0,
    estimated_score NUMERIC DEFAULT 0,
    trend TEXT DEFAULT 'stable',
    risk_factors TEXT[],
    recovery_plan_summary TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Tabelas de Simulação Clínica (Hardening)
CREATE TABLE IF NOT EXISTS public.clinical_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    case_id UUID NOT NULL REFERENCES public.clinical_cases(id),
    status TEXT DEFAULT 'active', -- 'active', 'finished', 'abandoned'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.clinical_scores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.clinical_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    anamnesis_score NUMERIC DEFAULT 0,
    physical_exam_score NUMERIC DEFAULT 0,
    diagnosis_score NUMERIC DEFAULT 0,
    management_score NUMERIC DEFAULT 0,
    final_grade TEXT,
    ai_feedback_json JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS em todas as novas tabelas
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_scores ENABLE ROW LEVEL SECURITY;

-- Criar Políticas de Acesso
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can access their own performance_metrics') THEN
        CREATE POLICY "Users can access their own performance_metrics" ON public.performance_metrics FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can access their own telemetry_events') THEN
        CREATE POLICY "Users can access their own telemetry_events" ON public.telemetry_events FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can access their own approval_predictions') THEN
        CREATE POLICY "Users can access their own approval_predictions" ON public.approval_predictions FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can access their own clinical_sessions') THEN
        CREATE POLICY "Users can access their own clinical_sessions" ON public.clinical_sessions FOR ALL USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can access their own clinical_scores') THEN
        CREATE POLICY "Users can access their own clinical_scores" ON public.clinical_scores FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Trigger para updated_at na performance_metrics
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_performance_metrics_updated_at
BEFORE UPDATE ON public.performance_metrics
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
