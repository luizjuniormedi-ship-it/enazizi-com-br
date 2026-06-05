
-- Core Curriculum Matrix
CREATE TABLE public.enamed_curriculum_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    great_area TEXT NOT NULL, -- e.g., Clínica Médica, Cirurgia
    specialty TEXT NOT NULL,  -- e.g., Cardiologia, Gastrenterologia
    theme TEXT NOT NULL,      -- e.g., Insuficiência Cardíaca
    subtheme TEXT,            -- e.g., Diagnóstico e Tratamento
    competence TEXT,          -- Specific medical competence
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indices for fast traversal
CREATE INDEX idx_enamed_matrix_area ON public.enamed_curriculum_matrix(great_area);
CREATE INDEX idx_enamed_matrix_specialty ON public.enamed_curriculum_matrix(specialty);
CREATE INDEX idx_enamed_matrix_theme ON public.enamed_curriculum_matrix(theme);

-- Weights and Incidence
CREATE TABLE public.enamed_theme_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES public.enamed_curriculum_matrix(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL, -- ENAMED, ENARE, USP, etc.
    historical_incidence DECIMAL(5,2) DEFAULT 0.0, -- 0-10 scale or percentage
    statistical_weight DECIMAL(5,2) DEFAULT 1.0,   -- Importance multiplier
    priority_level INTEGER DEFAULT 5,              -- 1-10
    year_reference INTEGER DEFAULT 2026,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(theme_id, exam_type, year_reference)
);

-- Student Readiness & Approval Chance (The new "Chance de Aprovação" dashboard engine)
CREATE TABLE public.student_exam_readiness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    great_area TEXT NOT NULL,
    current_score DECIMAL(5,2) DEFAULT 0.0,      -- 0-100%
    target_score DECIMAL(5,2) DEFAULT 80.0,
    readiness_index DECIMAL(5,2) DEFAULT 0.0,    -- Weighted probability
    mastery_level TEXT DEFAULT 'beginner',      -- beginner, intermediate, advanced, mastery
    last_computed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, great_area)
);

-- Target Exams per Student
CREATE TABLE public.student_target_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_id TEXT NOT NULL, -- e.g., 'enamed_2026', 'enare_2026'
    priority INTEGER DEFAULT 1,
    exam_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, exam_id)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_curriculum_matrix TO authenticated;
GRANT ALL ON public.enamed_curriculum_matrix TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.enamed_theme_weights TO authenticated;
GRANT ALL ON public.enamed_theme_weights TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_exam_readiness TO authenticated;
GRANT ALL ON public.student_exam_readiness TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_target_exams TO authenticated;
GRANT ALL ON public.student_target_exams TO service_role;

-- RLS
ALTER TABLE public.enamed_curriculum_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enamed_theme_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_target_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read matrix" ON public.enamed_curriculum_matrix FOR SELECT USING (true);
CREATE POLICY "Everyone can read weights" ON public.enamed_theme_weights FOR SELECT USING (true);

CREATE POLICY "Users can manage their own readiness" ON public.student_exam_readiness 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their target exams" ON public.student_target_exams 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_enamed_matrix_updated_at BEFORE UPDATE ON public.enamed_curriculum_matrix FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_enamed_weights_updated_at BEFORE UPDATE ON public.enamed_theme_weights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
