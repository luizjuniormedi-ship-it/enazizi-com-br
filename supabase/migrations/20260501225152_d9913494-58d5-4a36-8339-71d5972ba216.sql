-- Ensure user_id exists in cme_video_projects
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_video_projects' AND column_name = 'user_id') THEN
        ALTER TABLE public.cme_video_projects ADD COLUMN user_id uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- Add user_id to other critical tables if missing
ALTER TABLE public.cme_scene_graphs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cme_render_jobs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cme_pipeline_events ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cme_cognitive_analysis ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cme_system_incidents ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cme_pipeline_snapshots ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cme_recovery_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Enable RLS on all CME tables
ALTER TABLE public.cme_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_scene_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_cognitive_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_system_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_pipeline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_recovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_session_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_knowledge_lineage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own CME projects" ON public.cme_video_projects;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.cme_video_projects;
DROP POLICY IF EXISTS "Admins can manage CME projects" ON public.cme_video_projects;
DROP POLICY IF EXISTS "Students can view published projects" ON public.cme_video_projects;

-- Create robust RLS policies
CREATE POLICY "Users can manage their own CME projects"
ON public.cme_video_projects
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own scene graphs"
ON public.cme_scene_graphs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own render jobs"
ON public.cme_render_jobs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own pipeline events"
ON public.cme_pipeline_events
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cognitive analysis"
ON public.cme_cognitive_analysis
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own system incidents"
ON public.cme_system_incidents
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own snapshots"
ON public.cme_pipeline_snapshots
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recovery runs"
ON public.cme_recovery_runs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own aggregations"
ON public.cme_session_aggregations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Knowledge lineage is often shared or linked to projects
CREATE POLICY "Users can manage their own knowledge lineage"
ON public.cme_knowledge_lineage
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admin override (if profiles table exists with role)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        CREATE POLICY "Admins can view all CME data" 
        ON public.cme_video_projects FOR SELECT 
        USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
        -- Add for other tables as needed...
    END IF;
END $$;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';