-- Formal Governance: Intervention Policies
CREATE TABLE IF NOT EXISTS public.intervention_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- e.g., 'replay_spike', 'quiz_error_streak'
    severity_level TEXT CHECK (severity_level IN ('low', 'medium', 'high', 'critical')),
    max_per_session INTEGER DEFAULT 3,
    max_per_day INTEGER DEFAULT 10,
    cooldown_minutes INTEGER DEFAULT 60,
    min_confidence_score DOUBLE PRECISION DEFAULT 0.7,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expand adaptive_interventions for Governance & Audit
ALTER TABLE public.adaptive_interventions 
ADD COLUMN IF NOT EXISTS policy_id UUID REFERENCES public.intervention_policies(id),
ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS evidence_score DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS trigger_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS historical_effectiveness_snapshot DOUBLE PRECISION;

-- Track Cooldowns and Limits
CREATE TABLE IF NOT EXISTS public.adaptive_governance_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    policy_id UUID REFERENCES public.intervention_policies(id),
    action_type TEXT NOT NULL, -- 'intervention_blocked', 'cooldown_active', 'limit_reached'
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Metrics for Cognitive Stress and Frequency
ALTER TABLE public.adaptive_student_profiles 
ADD COLUMN IF NOT EXISTS cognitive_stress_index DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS intervention_frequency_score DOUBLE PRECISION DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_policy_violation_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.intervention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_governance_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read for intervention policies" ON public.intervention_policies FOR SELECT USING (true);
CREATE POLICY "Admins can manage policies" ON public.intervention_policies FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

CREATE POLICY "Users can view their own governance logs" ON public.adaptive_governance_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all governance logs" ON public.adaptive_governance_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type IN ('admin', 'professor')));

-- Seed Default Medical Pedagogy Policies
INSERT INTO public.intervention_policies (name, trigger_type, severity_level, max_per_session, max_per_day, cooldown_minutes, min_confidence_score, description)
VALUES 
('Tutor Proativo (Segurança)', 'tutor_open', 'low', 3, 10, 30, 0.6, 'Evita excesso de intervenção do Tutor para não criar dependência.'),
('Micro-revisão Emergencial', 'quiz_error', 'medium', 2, 5, 120, 0.8, 'Garante que micro-revisões não saturem o aluno após erros seguidos.'),
('Reroteamento Cognitivo', 'cognitive_stress', 'high', 1, 2, 240, 0.9, 'Intervenção crítica para evitar burnout e abandono quando o stress cognitivo dispara.'),
('Recuperação de Maestria', 'low_retention', 'critical', 1, 1, 1440, 0.95, 'Intervenção profunda para casos onde a retenção FSRS colapsa.');
