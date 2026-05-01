-- Ensure cme_scene_graphs has the correct structure
DO $$ 
BEGIN
    -- Add video_project_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'video_project_id') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN video_project_id uuid REFERENCES public.cme_video_projects(id) ON DELETE CASCADE;
    END IF;

    -- Add status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'status') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN status text DEFAULT 'draft';
    END IF;

    -- Add error_message if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'error_message') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN error_message text;
    END IF;

    -- Add graph_payload if it doesn't exist (renaming if necessary or just adding)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'graph_payload') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN graph_payload jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    -- Add metadata if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'metadata') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Fix indexes for cme_scene_graphs
CREATE INDEX IF NOT EXISTS idx_cme_scene_graphs_user_id ON public.cme_scene_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_cme_scene_graphs_project_id ON public.cme_scene_graphs(video_project_id);

-- Fix indexes for cme_scene_graph_nodes
CREATE INDEX IF NOT EXISTS idx_scene_nodes_graph_id ON public.cme_scene_graph_nodes(scene_graph_id);

-- Enable RLS
ALTER TABLE public.cme_scene_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_scene_graph_nodes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users insert own scene graphs" ON public.cme_scene_graphs;
    DROP POLICY IF EXISTS "Users select own scene graphs" ON public.cme_scene_graphs;
    DROP POLICY IF EXISTS "Users update own scene graphs" ON public.cme_scene_graphs;
    DROP POLICY IF EXISTS "Users insert own nodes" ON public.cme_scene_graph_nodes;
    DROP POLICY IF EXISTS "Users select own nodes" ON public.cme_scene_graph_nodes;
END $$;

-- Create hardened RLS policies
CREATE POLICY "Users insert own scene graphs"
ON public.cme_scene_graphs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users select own scene graphs"
ON public.cme_scene_graphs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users update own scene graphs"
ON public.cme_scene_graphs FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users insert own nodes"
ON public.cme_scene_graph_nodes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users select own nodes"
ON public.cme_scene_graph_nodes FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Reload PostgREST schema
NOTIFY pgrst, 'reload schema';
