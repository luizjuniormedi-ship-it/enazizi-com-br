CREATE TABLE IF NOT EXISTS public.hospital_economics_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    patient_id UUID REFERENCES public.hospital_patients(id),
    resource_type TEXT NOT NULL, -- 'exam', 'procedure', 'medication'
    resource_name TEXT NOT NULL,
    cost DECIMAL(10,2) DEFAULT 0,
    is_indicated BOOLEAN DEFAULT TRUE,
    impact_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_economics_logs TO authenticated;
GRANT ALL ON public.hospital_economics_logs TO service_role;
ALTER TABLE public.hospital_economics_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own economics logs" ON public.hospital_economics_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.hospital_simulation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    patient_id UUID REFERENCES public.hospital_patients(id),
    event_type TEXT NOT NULL, -- 'nurse_call', 'family_interruption', 'critical_result', 'clinical_deterioration'
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_simulation_events TO authenticated;
GRANT ALL ON public.hospital_simulation_events TO service_role;
ALTER TABLE public.hospital_simulation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own simulation events" ON public.hospital_simulation_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
