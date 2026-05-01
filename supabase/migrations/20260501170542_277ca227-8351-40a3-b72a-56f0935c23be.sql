-- A/B Experimentation Layer
CREATE TABLE IF NOT EXISTS public.adaptive_experiments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    target_metric TEXT NOT NULL, -- e.g., 'retention_fsrs', 'mastery_theoretical'
    variants JSONB NOT NULL, -- e.g., [{"id": "A", "name": "Feynman"}, {"id": "B", "name": "Micro-Quiz"}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_experiment_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    experiment_id UUID REFERENCES public.adaptive_experiments(id) ON DELETE CASCADE NOT NULL,
    variant_id TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, experiment_id)
);

-- Predictive Layer & Cognitive Fatigue
ALTER TABLE public.student_mastery_metrics 
ADD COLUMN IF NOT EXISTS overload_risk DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS retention_projection DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS false_mastery_risk DOUBLE PRECISION DEFAULT 0;

ALTER TABLE public.adaptive_student_profiles 
ADD COLUMN IF NOT EXISTS recovery_mode_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_recovery_at TIMESTAMP WITH TIME ZONE;

-- Link Interventions to Experiments
ALTER TABLE public.adaptive_interventions 
ADD COLUMN IF NOT EXISTS experiment_id UUID REFERENCES public.adaptive_experiments(id),
ADD COLUMN IF NOT EXISTS experiment_variant_id TEXT;

-- Scientific Analysis View (Materialized candidate or standard table)
CREATE TABLE IF NOT EXISTS public.adaptive_experiment_efficacy (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    experiment_id UUID REFERENCES public.adaptive_experiments(id),
    variant_id TEXT NOT NULL,
    sample_size INTEGER DEFAULT 0,
    avg_improvement_score DOUBLE PRECISION DEFAULT 0,
    retention_lift DOUBLE PRECISION DEFAULT 0,
    friction_reduction_score DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(experiment_id, variant_id)
);

-- Enable RLS
ALTER TABLE public.adaptive_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_experiment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_experiment_efficacy ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage experiments" ON public.adaptive_experiments FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

CREATE POLICY "Users can see their assignments" ON public.user_experiment_assignments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view efficacy" ON public.adaptive_experiment_efficacy FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Initial Seed for Experimentation
INSERT INTO public.adaptive_experiments (name, description, target_metric, variants)
VALUES 
('V1: Feynman vs Quiz (Cardio)', 'Teste de eficácia de intervenção para falhas em Cardiologia.', 'retention_fsrs', '[{"id": "A", "name": "Micro-Feynman"}, {"id": "B", "name": "Flash-Quiz"}]'),
('V1: Modalidade Visual vs Texto', 'Teste de preferência cognitiva em temas de Imagem Médica.', 'friction_reduction', '[{"id": "visual", "name": "Vídeo/Imagem"}, {"id": "text", "name": "Resumo Escrito"}]');
