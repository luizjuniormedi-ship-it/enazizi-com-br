CREATE TYPE public.prescription_validation_status AS ENUM ('correct', 'incorrect_dose', 'incorrect_route', 'incorrect_frequency', 'contraindicated', 'allergy_risk', 'safety_breach');
CREATE TYPE public.clinical_scale_type AS ENUM ('heart', 'timi', 'curb65', 'glasgow', 'nihss', 'qsofa', 'news2', 'wells', 'alvarado', 'cha2ds2vasc');

CREATE TABLE public.hospital_prescriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    medication TEXT NOT NULL,
    dosage TEXT NOT NULL,
    route TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration TEXT,
    validation_status prescription_validation_status DEFAULT 'correct',
    safety_feedback TEXT,
    clinical_impact TEXT, -- Piora, estável, melhora
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.hospital_clinical_scales (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    scale_type clinical_scale_type NOT NULL,
    score_value NUMERIC,
    interpretation TEXT,
    is_mandatory_missed BOOLEAN DEFAULT false, -- Detectado se o aluno esqueceu de usar
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.hospital_cognitive_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    duty_session_id UUID NOT NULL REFERENCES public.hospital_duty_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'nurse_call', 'family_request', 'critical_result', 'equipment_fail'
    priority TEXT DEFAULT 'medium',
    message TEXT NOT NULL,
    action_taken TEXT,
    response_time_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.hospital_errors_v2 (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    duty_session_id UUID REFERENCES public.hospital_duty_sessions(id) ON DELETE CASCADE,
    theme TEXT NOT NULL,
    error_type TEXT NOT NULL, -- 'diagnosis', 'management', 'prescription', 'prioritization', 'safety', 'scale'
    specialty TEXT,
    severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
    clinical_consequence TEXT,
    safety_impact TEXT,
    cognitive_level TEXT, -- 'novice', 'exposed', 'weak', 'practicing', 'mastery'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    fsrs_synced BOOLEAN DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_prescriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_clinical_scales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_cognitive_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_errors_v2 TO authenticated;

GRANT ALL ON public.hospital_prescriptions TO service_role;
GRANT ALL ON public.hospital_clinical_scales TO service_role;
GRANT ALL ON public.hospital_cognitive_events TO service_role;
GRANT ALL ON public.hospital_errors_v2 TO service_role;

ALTER TABLE public.hospital_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_clinical_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_cognitive_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_errors_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage prescriptions of their patients" ON public.hospital_prescriptions FOR ALL USING (EXISTS (SELECT 1 FROM public.hospital_patients p JOIN public.hospital_duty_sessions s ON p.duty_session_id = s.id WHERE p.id = public.hospital_prescriptions.patient_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can manage scales of their patients" ON public.hospital_clinical_scales FOR ALL USING (EXISTS (SELECT 1 FROM public.hospital_patients p JOIN public.hospital_duty_sessions s ON p.duty_session_id = s.id WHERE p.id = public.hospital_clinical_scales.patient_id AND s.user_id = auth.uid()));
CREATE POLICY "Users can manage cognitive events in their sessions" ON public.hospital_cognitive_events FOR ALL USING (EXISTS (SELECT 1 FROM public.hospital_duty_sessions WHERE id = public.hospital_cognitive_events.duty_session_id AND user_id = auth.uid()));
CREATE POLICY "Users can view their own errors v2" ON public.hospital_errors_v2 FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage errors v2" ON public.hospital_errors_v2 FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
