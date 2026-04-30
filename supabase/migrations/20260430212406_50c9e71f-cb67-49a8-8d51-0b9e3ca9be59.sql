-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a table for Institutional Medical Materials (ProntoMedic exports)
CREATE TABLE IF NOT EXISTS public.medical_institutional_materials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- 'protocol', 'pop', 'training', 'checklist', 'clinical_summary'
    discipline TEXT,
    content TEXT,
    notebooklm_audio_url TEXT,
    notebooklm_guide_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'review', 'approved', 'published'
    reliability_score NUMERIC DEFAULT 0,
    technical_supervisor UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.medical_institutional_materials ENABLE ROW LEVEL SECURITY;

-- Policies (using user_type instead of role)
CREATE POLICY "Medical staff can view all materials"
ON public.medical_institutional_materials
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND (profiles.user_type IN ('admin', 'editor', 'teacher'))
));

CREATE POLICY "Admins can manage materials"
ON public.medical_institutional_materials
FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND (profiles.user_type = 'admin')
));

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_medical_institutional_materials_updated_at ON public.medical_institutional_materials;
CREATE TRIGGER update_medical_institutional_materials_updated_at
BEFORE UPDATE ON public.medical_institutional_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
