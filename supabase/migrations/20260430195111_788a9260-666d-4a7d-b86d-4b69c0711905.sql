-- 1. Create medical_content_scores table
CREATE TABLE IF NOT EXISTS public.medical_content_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES auth.users(id),
    
    -- Scientific & Clinical Scores
    scientific_accuracy_score NUMERIC CHECK (scientific_accuracy_score BETWEEN 0 AND 10),
    guideline_adherence_score NUMERIC CHECK (guideline_adherence_score BETWEEN 0 AND 10),
    clinical_safety_score NUMERIC CHECK (clinical_safety_score BETWEEN 0 AND 10),
    hallucination_risk_score NUMERIC CHECK (hallucination_risk_score BETWEEN 0 AND 10),
    
    -- Pedagogical & Utility Scores
    pedagogical_clarity_score NUMERIC CHECK (pedagogical_clarity_score BETWEEN 0 AND 10),
    depth_score NUMERIC CHECK (depth_score BETWEEN 0 AND 10),
    feynman_quality_score NUMERIC CHECK (feynman_quality_score BETWEEN 0 AND 10),
    flashcard_quality_score NUMERIC CHECK (flashcard_quality_score BETWEEN 0 AND 10),
    quiz_quality_score NUMERIC CHECK (quiz_quality_score BETWEEN 0 AND 10),
    exam_utility_score NUMERIC CHECK (exam_utility_score BETWEEN 0 AND 10),
    clinical_utility_score NUMERIC CHECK (clinical_utility_score BETWEEN 0 AND 10),
    
    -- Totals & Metadata
    reliability_score NUMERIC,
    final_score NUMERIC,
    review_notes TEXT,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Governance Audit Logs
CREATE TABLE IF NOT EXISTS public.governance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES public.master_content_library(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL, -- e.g., 'STATUS_CHANGE', 'SCORE_SUBMITTED', 'REJECTED'
    from_status TEXT,
    to_status TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update master_content_library to support the new workflow and NotebookLM
ALTER TABLE public.master_content_library 
ADD COLUMN IF NOT EXISTS double_reviewed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notebooklm_export_version TEXT,
ADD COLUMN IF NOT EXISTS media_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS exported_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS exported_at TIMESTAMP WITH TIME ZONE;

-- 4. Enable RLS on all related tables
ALTER TABLE public.medical_content_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Roles

-- Helper function to check roles (using app_metadata or custom profile table if it exists)
-- Note: Assuming a 'profiles' table or similar exists with a 'role' column. 
-- If not, these can be adjusted to check JWT claims.

-- ADMIN: Full Access
CREATE POLICY "Admins have full access to scores" ON public.medical_content_scores
FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins have full access to logs" ON public.governance_audit_logs
FOR ALL TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

-- PROFESSOR: View/Insert Scores, View Logs
CREATE POLICY "Professors can manage pedagogical scores" ON public.medical_content_scores
FOR ALL TO authenticated 
USING (auth.jwt() ->> 'role' IN ('admin', 'professor'));

-- MEDICAL SPECIALIST: Manage Scientific Scores
CREATE POLICY "Specialists can manage scientific scores" ON public.medical_content_scores
FOR ALL TO authenticated 
USING (auth.jwt() ->> 'role' IN ('admin', 'medical_specialist'));

-- STUDENT: Read-only access to published content scores (summary only or restricted)
CREATE POLICY "Students can view limited score info for published" ON public.medical_content_scores
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.master_content_library 
        WHERE id = medical_content_scores.content_id AND status = 'published'
    )
);

-- 6. Trigger for Publication Locks & Auto-Validation
CREATE OR REPLACE FUNCTION public.check_medical_publication_readiness()
RETURNS TRIGGER AS $$
DECLARE
    avg_accuracy NUMERIC;
    avg_safety NUMERIC;
    max_hallucination NUMERIC;
    scientific_rev_count INTEGER;
BEGIN
    -- Only check when trying to set status to 'published'
    IF NEW.status = 'published' THEN
        
        -- Get latest scores for this content
        SELECT 
            AVG(scientific_accuracy_score), 
            AVG(clinical_safety_score), 
            MAX(hallucination_risk_score),
            COUNT(*)
        INTO avg_accuracy, avg_safety, max_hallucination, scientific_rev_count
        FROM public.medical_content_scores
        WHERE content_id = NEW.id;

        -- Apply Business Rules (The "Locks")
        IF (avg_accuracy < 8 OR avg_accuracy IS NULL) THEN
            RAISE EXCEPTION 'Scientific accuracy score must be >= 8 to publish.';
        END IF;

        IF (avg_safety < 8 OR avg_safety IS NULL) THEN
            RAISE EXCEPTION 'Clinical safety score must be >= 8 to publish.';
        END IF;

        IF (max_hallucination > 4) THEN
            RAISE EXCEPTION 'Hallucination risk is too high (> 4). Blocked.';
        END IF;

        IF (scientific_rev_count < 1) THEN
            RAISE EXCEPTION 'Scientific review missing. Publication blocked.';
        END IF;
    END IF;

    -- Track status changes in audit logs
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.governance_audit_logs (content_id, user_id, action, from_status, to_status)
        VALUES (NEW.id, auth.uid(), 'STATUS_CHANGE', OLD.status, NEW.status);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_medical_governance_before_publish
BEFORE UPDATE ON public.master_content_library
FOR EACH ROW
EXECUTE FUNCTION public.check_medical_publication_readiness();
