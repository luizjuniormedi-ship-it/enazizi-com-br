-- 1. Governance & Audit: Workflow logs
CREATE TABLE public.cme_governance_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.cme_video_projects(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    reviewer_id UUID REFERENCES auth.users(id),
    verdict TEXT, -- approved, rejected, rollback
    comments TEXT,
    metadata JSONB DEFAULT '{}'::jsonb, -- medical_errors, narrative_notes, render_artifacts
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Render Chunking: Parallel scene rendering
CREATE TABLE public.cme_render_chunks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    render_job_id UUID REFERENCES public.cme_render_jobs(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES public.cme_scene_graphs(id),
    chunk_order INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, rendering, completed, failed
    worker_id UUID REFERENCES public.cme_gpu_workers(id),
    output_url TEXT,
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. ACE Feedback Loop: Friction to Intervention mapping
CREATE TABLE public.cme_adaptive_interventions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.adaptive_student_profiles(user_id),
    project_id UUID REFERENCES public.cme_video_projects(id),
    variant_id UUID REFERENCES public.cme_render_jobs(id),
    friction_type TEXT NOT NULL, -- high_replay, abandonment, stress_spike, drift
    chapter_ref TEXT,
    intervention_type TEXT, -- suggested_micro_review, variant_switch, tutor_temporal
    efficacy_score NUMERIC, -- measured after intervention
    ace_decision_id UUID, -- reference to orchestrator decision
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Expand existing tables for new capabilities
ALTER TABLE public.cme_video_projects
ADD COLUMN IF NOT EXISTS quality_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS validation_checks JSONB DEFAULT '{
    "semantic_plan": false,
    "narrative_script": false,
    "pacing_map": false,
    "scene_graph": false,
    "medical_review": false,
    "final_render": false
}'::jsonb;

ALTER TABLE public.cme_render_jobs
ADD COLUMN IF NOT EXISTS variant_type TEXT DEFAULT 'full_lecture', -- full_lecture, quick_review, recovery, intensive, exam_sprint, feynman, microlearning, tutor_reinforcement
ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES public.cme_render_jobs(id), -- For variants generated from a master job
ADD COLUMN IF NOT EXISTS chunk_composition_status TEXT DEFAULT 'pending';

-- Enable RLS
ALTER TABLE public.cme_governance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_adaptive_interventions ENABLE ROW LEVEL SECURITY;

-- Basic Policies
CREATE POLICY "Admins can manage governance" ON public.cme_governance_logs FOR ALL USING (true);
CREATE POLICY "Workers manage chunks" ON public.cme_render_chunks FOR ALL USING (true);
CREATE POLICY "Students view their interventions" ON public.cme_adaptive_interventions FOR SELECT USING (auth.uid() = student_id);

-- Publication Guardian: Logic to block 'published' status if checks fail
CREATE OR REPLACE FUNCTION public.check_cme_publication_readiness()
RETURNS TRIGGER AS $$
BEGIN
    -- If trying to publish, verify requirements
    IF NEW.status = 'published' AND OLD.status != 'published' THEN
        IF (NEW.validation_checks->>'semantic_plan')::boolean = false OR
           (NEW.validation_checks->>'narrative_script')::boolean = false OR
           (NEW.validation_checks->>'pacing_map')::boolean = false OR
           (NEW.validation_checks->>'scene_graph')::boolean = false OR
           (NEW.validation_checks->>'medical_review')::boolean = false OR
           (NEW.validation_checks->>'final_render')::boolean = false OR
           COALESCE(NEW.quality_score, 0) < 8 THEN
            RAISE EXCEPTION 'CME project not ready for publication. Verify all validation checks and quality score (min 8).';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cme_publication_guardian
BEFORE UPDATE ON public.cme_video_projects
FOR EACH ROW
EXECUTE FUNCTION public.check_cme_publication_readiness();

-- Status Change Logging Trigger
CREATE OR REPLACE FUNCTION public.log_cme_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO public.cme_governance_logs (project_id, from_status, to_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cme_status_logger
AFTER UPDATE ON public.cme_video_projects
FOR EACH ROW
EXECUTE FUNCTION public.log_cme_status_change();