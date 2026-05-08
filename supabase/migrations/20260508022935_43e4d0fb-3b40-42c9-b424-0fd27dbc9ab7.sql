-- Create clinical quality profiles table
CREATE TABLE IF NOT EXISTS public.clinical_quality_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialty TEXT NOT NULL UNIQUE,
    average_quality FLOAT DEFAULT 0,
    regeneration_rate FLOAT DEFAULT 0,
    preferred_model TEXT DEFAULT 'gpt-4o-mini',
    fallback_model TEXT DEFAULT 'gpt-4o',
    requires_references BOOLEAN DEFAULT false,
    explanation_depth TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
    prompt_profile TEXT DEFAULT 'standard', -- 'standard', 'deep_clinical', 'guideline_focused'
    total_audited INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clinical_quality_profiles ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to clinical quality profiles"
ON public.clinical_quality_profiles FOR SELECT
TO authenticated
USING (true);

-- Insert initial seeds for critical specialties
INSERT INTO public.clinical_quality_profiles 
(specialty, preferred_model, fallback_model, requires_references, explanation_depth, prompt_profile)
VALUES 
('Medicina Preventiva', 'gpt-4o', 'o1-preview', true, 'high', 'guideline_focused'),
('Cardiologia', 'gpt-4o-mini', 'gpt-4o', false, 'medium', 'standard'),
('Ginecologia e Obstetrícia', 'gpt-4o-mini', 'gpt-4o', true, 'medium', 'standard'),
('Pediatria', 'gpt-4o-mini', 'gpt-4o', true, 'medium', 'standard'),
('Cirurgia Geral', 'gpt-4o-mini', 'gpt-4o', false, 'medium', 'standard'),
('Clínica Médica', 'gpt-4o', 'o1-preview', true, 'high', 'deep_clinical')
ON CONFLICT (specialty) DO NOTHING;

-- Function to update profiles based on recent audits
CREATE OR REPLACE FUNCTION public.recalibrate_clinical_profiles()
RETURNS void AS $$
BEGIN
    WITH audit_stats AS (
        SELECT 
            specialty,
            AVG(final_quality_score) as avg_q,
            SUM(CASE WHEN NOT is_approved THEN 1 ELSE 0 END)::float / COUNT(*)::float as reg_rate,
            COUNT(*) as total
        FROM public.exam_clinical_audits
        WHERE created_at > now() - interval '30 days'
        GROUP BY specialty
    )
    UPDATE public.clinical_quality_profiles p
    SET 
        average_quality = s.avg_q,
        regeneration_rate = s.reg_rate,
        total_audited = s.total,
        updated_at = now(),
        -- Auto-routing logic
        preferred_model = CASE 
            WHEN s.reg_rate > 0.20 OR s.avg_q < 85 THEN p.fallback_model 
            ELSE p.preferred_model 
        END,
        explanation_depth = CASE 
            WHEN s.reg_rate > 0.15 THEN 'high'
            ELSE p.explanation_depth
        END
    FROM audit_stats s
    WHERE p.specialty = s.specialty;
END;
$$ LANGUAGE plpgsql SET search_path = public;
