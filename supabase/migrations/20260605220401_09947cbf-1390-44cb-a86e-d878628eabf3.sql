CREATE TYPE public.hospital_sector_type AS ENUM ('sala_vermelha', 'sala_laranja', 'sala_amarela', 'sala_verde', 'observacao', 'uti', 'enfermaria', 'ambulatorio');
CREATE TYPE public.patient_clinical_status AS ENUM ('estavel', 'instavel', 'grave', 'critico', 'pcr', 'obito', 'alta');

CREATE TABLE public.hospital_duty_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    finished_at TIMESTAMP WITH TIME ZONE,
    total_xp INTEGER DEFAULT 0,
    overall_grade TEXT,
    cognitive_state_before TEXT,
    cognitive_state_after TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.hospital_patients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    duty_session_id UUID NOT NULL REFERENCES public.hospital_duty_sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    main_complaint TEXT,
    sector hospital_sector_type NOT NULL,
    current_status patient_clinical_status DEFAULT 'estavel',
    vitals JSONB DEFAULT '{}'::jsonb,
    history_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    hidden_diagnosis TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.hospital_clinical_clocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'door_to_ecg', 'door_to_needle', 'door_to_antibiotic'
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    target_minutes INTEGER NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    outcome TEXT, -- 'success', 'delayed', 'failed'
    clinical_consequence TEXT
);

CREATE TABLE public.hospital_exams_queue (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    exam_name TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    eta_minutes INTEGER NOT NULL,
    ready_at TIMESTAMP WITH TIME ZONE,
    results_json JSONB,
    priority TEXT DEFAULT 'routine' -- 'routine', 'emergency'
);

CREATE TABLE public.hospital_incidents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    duty_session_id UUID NOT NULL REFERENCES public.hospital_duty_sessions(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL, -- 'safety', 'omission', 'dosage', 'interaction', 'missing_scale'
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    related_theme TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_duty_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_patients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_clinical_clocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_exams_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_incidents TO authenticated;

GRANT ALL ON public.hospital_duty_sessions TO service_role;
GRANT ALL ON public.hospital_patients TO service_role;
GRANT ALL ON public.hospital_clinical_clocks TO service_role;
GRANT ALL ON public.hospital_exams_queue TO service_role;
GRANT ALL ON public.hospital_incidents TO service_role;

ALTER TABLE public.hospital_duty_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_clinical_clocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_exams_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own duty sessions" ON public.hospital_duty_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can manage patients in their sessions" ON public.hospital_patients FOR ALL USING (EXISTS (SELECT 1 FROM public.hospital_duty_sessions WHERE id = public.hospital_patients.duty_session_id AND user_id = auth.uid()));
CREATE POLICY "Users can manage clocks in their sessions" ON public.hospital_clinical_clocks FOR ALL USING (EXISTS (SELECT 1 FROM public.hospital_patients p JOIN public.hospital_duty_sessions s ON p.duty_session_id = s.id WHERE p.id = public.hospital_clinical_clocks.patient_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can manage exams in their sessions" ON public.hospital_exams_queue FOR ALL USING (EXISTS (SELECT 1 FROM public.hospital_patients p JOIN public.hospital_duty_sessions s ON p.duty_session_id = s.id WHERE p.id = public.hospital_exams_queue.patient_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can manage incidents in their sessions" ON public.hospital_incidents FOR ALL USING (auth.uid() IN (SELECT user_id FROM public.hospital_duty_sessions WHERE id = public.hospital_incidents.duty_session_id));

CREATE TRIGGER update_hospital_patients_updated_at BEFORE UPDATE ON public.hospital_patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
