-- Enhance pipeline events with metadata for better debugging
ALTER TABLE public.cme_pipeline_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add started_rendering_at to render jobs for latency auditing
ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS started_rendering_at TIMESTAMP WITH TIME ZONE;

-- Add last_error and content_hash to lesson blocks for resilience
ALTER TABLE public.cme_lesson_blocks 
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create an index on aggregation_id for fast lookups in projects
CREATE INDEX IF NOT EXISTS idx_cme_video_projects_aggregation_id ON public.cme_video_projects(aggregation_id);

-- Create a consolidated view for the builder audit dashboard
CREATE OR REPLACE VIEW public.cme_session_aggregation_summary AS
SELECT 
    sa.id,
    sa.tutor_session_id,
    sa.status,
    sa.total_blocks,
    sa.created_at,
    sa.started_at,
    sa.completed_at,
    sa.error_message,
    vp.id AS video_project_id,
    vp.title AS project_title,
    rj.status AS render_status,
    rj.render_stage AS render_stage
FROM public.cme_session_aggregations sa
LEFT JOIN public.cme_video_projects vp ON sa.id = vp.aggregation_id
LEFT JOIN public.cme_render_jobs rj ON vp.id = rj.project_id;

-- Ensure RLS is updated for the new view (views inherit base table RLS, but we grant access)
GRANT SELECT ON public.cme_session_aggregation_summary TO authenticated;
