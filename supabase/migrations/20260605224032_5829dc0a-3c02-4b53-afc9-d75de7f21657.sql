
-- Setores Hospitalares (faltante na infra anterior)
CREATE TABLE public.hospital_sectors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    capacity INTEGER DEFAULT 10,
    complexity_level INTEGER DEFAULT 1, -- 1: Ambulatório, 5: UTI/Sala Vermelha
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Equipe Assistencial Viva
CREATE TABLE public.hospital_staff (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'nurse', 'technician', 'resident_r1', 'family', 'regulation', 'preceptor'
    personality_traits TEXT[],
    competence_level FLOAT DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.hospital_staff_interactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_session_id UUID REFERENCES public.hospital_duty_sessions(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES public.hospital_staff(id),
    patient_id UUID REFERENCES public.hospital_patients(id),
    message TEXT NOT NULL,
    interaction_type TEXT NOT NULL, -- 'alert', 'suggestion', 'request', 'complaint', 'sbar', 'spikes'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Segurança do Paciente
CREATE TABLE public.hospital_adverse_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_session_id UUID REFERENCES public.hospital_duty_sessions(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.hospital_patients(id),
    event_type TEXT NOT NULL, -- 'medication_error', 'fall', 'identification_failure', 'allergic_reaction'
    severity TEXT NOT NULL, -- 'near_miss', 'low', 'moderate', 'high', 'sentinel'
    description TEXT,
    was_preventable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recursos e Economia
CREATE TABLE public.hospital_resources (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    resource_type TEXT NOT NULL, -- 'cti_bed', 'ventilator', 'operating_room', 'blood_bag'
    total_capacity INTEGER NOT NULL,
    current_occupancy INTEGER DEFAULT 0,
    unit_cost_estimate FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.hospital_economic_metrics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_session_id UUID REFERENCES public.hospital_duty_sessions(id) ON DELETE CASCADE,
    total_cost FLOAT DEFAULT 0,
    overuse_score FLOAT DEFAULT 0,
    waste_details JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Carreira
CREATE TABLE public.hospital_career_path (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    current_title TEXT DEFAULT 'interno', -- 'interno', 'residente_r1', 'residente_r3', 'preceptor', 'chefe_plantao'
    xp_points INTEGER DEFAULT 0,
    skills_matrix JSONB DEFAULT '{}'::jsonb,
    completed_scenarios INTEGER DEFAULT 0,
    leadership_score FLOAT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_sectors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_staff_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_adverse_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_resources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_economic_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_career_path TO authenticated;

GRANT ALL ON public.hospital_sectors TO service_role;
GRANT ALL ON public.hospital_staff TO service_role;
GRANT ALL ON public.hospital_staff_interactions TO service_role;
GRANT ALL ON public.hospital_adverse_events TO service_role;
GRANT ALL ON public.hospital_resources TO service_role;
GRANT ALL ON public.hospital_economic_metrics TO service_role;
GRANT ALL ON public.hospital_career_path TO service_role;

-- RLS
ALTER TABLE public.hospital_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_staff_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_adverse_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_economic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_career_path ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public sectors access" ON public.hospital_sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public staff access" ON public.hospital_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage interactions for their sessions" ON public.hospital_staff_interactions
    FOR ALL USING (EXISTS (SELECT 1 FROM public.hospital_duty_sessions WHERE id = hospital_session_id AND user_id = auth.uid()));
CREATE POLICY "Users can view career path" ON public.hospital_career_path
    FOR SELECT USING (auth.uid() = user_id);

-- Seed básico de setores
INSERT INTO public.hospital_sectors (name, description, complexity_level, capacity) VALUES
('Triagem', 'Classificação de risco inicial', 1, 50),
('Enfermaria', 'Cuidados intermediários', 2, 20),
('Sala Vermelha', 'Emergência crítica', 4, 5),
('UTI', 'Terapia intensiva', 5, 10),
('Centro Cirúrgico', 'Procedimentos invasivos', 4, 3);
