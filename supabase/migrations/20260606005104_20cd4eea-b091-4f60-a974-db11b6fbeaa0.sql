CREATE TABLE IF NOT EXISTS public.hospital_shadow_audits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    simulation_id UUID,
    scores JSONB NOT NULL,
    report JSONB NOT NULL,
    recovery_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_shadow_audits TO authenticated;
GRANT ALL ON public.hospital_shadow_audits TO service_role;

ALTER TABLE public.hospital_shadow_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own shadow audits" 
ON public.hospital_shadow_audits FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.hospital_errors_v2 (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    theme TEXT NOT NULL,
    error_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    clinical_consequence TEXT,
    cognitive_level TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_errors_v2 TO authenticated;
GRANT ALL ON public.hospital_errors_v2 TO service_role;

ALTER TABLE public.hospital_errors_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own errors v2" 
ON public.hospital_errors_v2 FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);