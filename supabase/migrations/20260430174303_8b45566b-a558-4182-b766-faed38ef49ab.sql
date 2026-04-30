-- Create ai_usage_logs for token and cost tracking
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    user_id UUID REFERENCES auth.users(id),
    content_id UUID REFERENCES public.master_content_library(id),
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost NUMERIC(10, 6) DEFAULT 0,
    reused_from_cache BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ai_content_audit_logs for action history
CREATE TABLE IF NOT EXISTS public.ai_content_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    new_status TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create pedagogical_reviews for quality audit
CREATE TABLE IF NOT EXISTS public.pedagogical_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES public.master_content_library(id),
    reviewer_id UUID REFERENCES auth.users(id),
    score INTEGER CHECK (score >= 1 AND score <= 5),
    quality_label TEXT CHECK (quality_label IN ('Excelente', 'Bom', 'Revisar', 'Reprovado')),
    scientific_accuracy_score INTEGER CHECK (scientific_accuracy_score >= 1 AND scientific_accuracy_score <= 5),
    didactic_score INTEGER CHECK (didactic_score >= 1 AND didactic_score <= 5),
    hallucination_risk TEXT CHECK (hallucination_risk IN ('none', 'low', 'medium', 'high')),
    comments TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_content_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for Admins and Professors
CREATE POLICY "Admins and professors can view usage logs"
ON public.ai_usage_logs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'professor')
));

CREATE POLICY "Admins and professors can view audit logs"
ON public.ai_content_audit_logs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'professor')
));

CREATE POLICY "Admins and professors can manage reviews"
ON public.pedagogical_reviews FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type IN ('admin', 'professor')
));

-- Trigger to update master_content_library reviewed_by on review insert
CREATE OR REPLACE FUNCTION update_content_status_on_review()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.master_content_library
    SET 
        status = CASE 
            WHEN NEW.quality_label = 'Reprovado' THEN 'failed'
            WHEN NEW.quality_label = 'Revisar' THEN 'draft'
            ELSE 'review'
        END,
        reviewed_by = NEW.reviewer_id,
        updated_at = now()
    WHERE id = NEW.content_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_update_content_status_on_review
AFTER INSERT ON public.pedagogical_reviews
FOR EACH ROW EXECUTE FUNCTION update_content_status_on_review();
