-- Table for Medical Learning Benchmarks
CREATE TABLE IF NOT EXISTS public.medical_benchmarks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL,
    specialty TEXT NOT NULL,
    avg_retention_fsrs FLOAT DEFAULT 0.0,
    error_rate FLOAT DEFAULT 0.0,
    avg_review_time_seconds INTEGER DEFAULT 0,
    simulation_performance_score FLOAT DEFAULT 0.0,
    sample_size_students INTEGER DEFAULT 0,
    benchmark_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Table for Hallucination and Scientific Risk Queue (Critical Events)
CREATE TABLE IF NOT EXISTS public.hallucination_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id UUID REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    reporter_id UUID REFERENCES auth.users(id),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    issue_type TEXT NOT NULL CHECK (issue_type IN ('wrong_dosage', 'outdated_guideline', 'wrong_conduct', 'missing_contraindication', 'other')),
    description TEXT NOT NULL,
    original_text TEXT,
    suggested_correction TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    prompt_version_id UUID REFERENCES public.medical_ai_prompts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add metrics to master library
ALTER TABLE public.master_content_library 
ADD COLUMN IF NOT EXISTS impact_score FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS learning_efficiency_rating FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS hallucination_count INTEGER DEFAULT 0;

-- View for Prompt Performance Analytics
CREATE OR REPLACE VIEW public.prompt_performance_analytics AS
SELECT 
    p.id as prompt_id,
    p.prompt_name,
    p.prompt_version,
    p.specialty,
    COUNT(m.id) as total_generations,
    AVG(r.precision_score) as avg_precision,
    AVG(r.scientific_accuracy_score) as avg_scientific_accuracy,
    COUNT(h.id) FILTER (WHERE h.risk_level = 'critical') as critical_hallucinations,
    COUNT(h.id) as total_issues
FROM public.medical_ai_prompts p
LEFT JOIN public.master_content_library m ON m.metadata->>'prompt_id' = p.id::text
LEFT JOIN public.pedagogical_reviews r ON r.content_id = m.id
LEFT JOIN public.hallucination_reports h ON h.prompt_version_id = p.id
GROUP BY p.id, p.prompt_name, p.prompt_version, p.specialty;

-- Enable RLS
ALTER TABLE public.medical_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hallucination_reports ENABLE ROW LEVEL SECURITY;

-- Policies for Benchmarks (using user_type instead of role)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins and teachers can view benchmarks') THEN
        CREATE POLICY "Admins and teachers can view benchmarks"
        ON public.medical_benchmarks FOR SELECT
        USING (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND user_type IN ('admin', 'teacher')
        ));
    END IF;
END $$;

-- Policies for Hallucination Reports
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins and specialists can manage hallucination reports') THEN
        CREATE POLICY "Admins and specialists can manage hallucination reports"
        ON public.hallucination_reports FOR ALL
        USING (EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND user_type IN ('admin', 'teacher')
        ));
    END IF;
END $$;

-- Trigger for hallucination count
CREATE OR REPLACE FUNCTION public.increment_hallucination_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.master_content_library
    SET hallucination_count = hallucination_count + 1
    WHERE id = NEW.content_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_increment_hallucination ON public.hallucination_reports;
CREATE TRIGGER tr_increment_hallucination
AFTER INSERT ON public.hallucination_reports
FOR EACH ROW
EXECUTE FUNCTION public.increment_hallucination_count();