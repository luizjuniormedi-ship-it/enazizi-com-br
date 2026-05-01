-- Reference Uploads: Managing the lifecycle of benchmark videos
CREATE TABLE public.cme_reference_uploads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_id UUID REFERENCES public.cme_cinematic_reference_profiles(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES auth.users(id),
    file_path TEXT NOT NULL, -- storage path
    file_size_bytes BIGINT,
    mime_type TEXT,
    original_filename TEXT,
    upload_status TEXT DEFAULT 'uploaded', -- uploaded, analyzing, benchmark_ready, approved_reference, active_benchmark, archived
    specialty TEXT,
    pedagogical_goal TEXT,
    analysis_logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Explainability expansion for Quality Scoring
ALTER TABLE public.cme_cinematic_quality_score
ADD COLUMN IF NOT EXISTS scoring_explanation JSONB DEFAULT '{}'::jsonb, -- why the score was given, influencing segments, improvement tips
ADD COLUMN IF NOT EXISTS segment_weights JSONB DEFAULT '{}'::jsonb; -- which parts of the video weighed most

-- Explainability expansion for Similarity Reports
ALTER TABLE public.cme_cinematic_similarity_reports
ADD COLUMN IF NOT EXISTS comparison_explanation JSONB DEFAULT '{}'::jsonb; -- breakdown of similarity/divergence

-- Profile Expansion: Timings & Hotspots logic
ALTER TABLE public.cme_cinematic_reference_profiles
ADD COLUMN IF NOT EXISTS ideal_timings JSONB DEFAULT '{}'::jsonb, -- chapter_durations, pause_intervals, micro_recall_slots
ADD COLUMN IF NOT EXISTS hotspot_heuristics JSONB DEFAULT '{}'::jsonb, -- logic to detect probable replay/abandonment areas
ADD COLUMN IF NOT EXISTS feynman_trigger_points JSONB DEFAULT '[]'::jsonb; -- timestamps needing simpler explanations

-- Benchmark Audit: Tracking how references are used
CREATE TABLE public.cme_benchmark_audit (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    reference_id UUID REFERENCES public.cme_cinematic_reference_profiles(id),
    render_job_id UUID REFERENCES public.cme_render_jobs(id),
    action_type TEXT NOT NULL, -- comparison, model_extraction, approved_usage
    actor_id UUID REFERENCES auth.users(id),
    decision_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cme_reference_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_benchmark_audit ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins manage reference uploads" ON public.cme_reference_uploads FOR ALL USING (true);
CREATE POLICY "Admins view benchmark audits" ON public.cme_benchmark_audit FOR SELECT USING (true);

-- Workflow Trigger: Update profile status when upload status changes
CREATE OR REPLACE FUNCTION public.sync_cme_reference_status()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.upload_status != NEW.upload_status AND NEW.reference_id IS NOT NULL THEN
        UPDATE public.cme_cinematic_reference_profiles
        SET reference_type = CASE 
            WHEN NEW.upload_status = 'active_benchmark' THEN 'official_benchmark'
            ELSE reference_type 
        END
        WHERE id = NEW.reference_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cme_reference_status_sync
AFTER UPDATE ON public.cme_reference_uploads
FOR EACH ROW
EXECUTE FUNCTION public.sync_cme_reference_status();

-- Storage Bucket for CME References
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cme-references', 'cme-references', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload references" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cme-references');
CREATE POLICY "Admins can read references" ON storage.objects FOR SELECT USING (bucket_id = 'cme-references');