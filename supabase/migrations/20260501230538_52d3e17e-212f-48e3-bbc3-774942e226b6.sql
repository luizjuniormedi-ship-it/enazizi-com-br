-- Hardening cme_scene_graphs
DO $$ 
BEGIN
    -- Rename columns if they exist with legacy names
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'project_id') THEN
        ALTER TABLE public.cme_scene_graphs RENAME COLUMN project_id TO video_project_id;
    END IF;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'video_project_id') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN video_project_id UUID REFERENCES public.cme_video_projects(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'user_id') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'graph_payload') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN graph_payload JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'metadata') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'error_message') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN error_message TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'updated_at') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graphs' AND column_name = 'session_id') THEN
        ALTER TABLE public.cme_scene_graphs ADD COLUMN session_id UUID;
    END IF;
END $$;

-- Hardening cme_scene_graph_nodes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graph_nodes' AND column_name = 'user_id') THEN
        ALTER TABLE public.cme_scene_graph_nodes ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graph_nodes' AND column_name = 'title') THEN
        ALTER TABLE public.cme_scene_graph_nodes ADD COLUMN title TEXT;
    END IF;

    -- Rename order to maintain standard
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graph_nodes' AND column_name = 'node_order') THEN
        ALTER TABLE public.cme_scene_graph_nodes RENAME COLUMN node_order TO sequence_order;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cme_scene_graph_nodes' AND column_name = 'payload') THEN
        ALTER TABLE public.cme_scene_graph_nodes ADD COLUMN payload JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Indexes (Now safe as columns exist)
CREATE INDEX IF NOT EXISTS idx_cme_scene_graphs_user_id ON public.cme_scene_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_cme_scene_graphs_video_project_id ON public.cme_scene_graphs(video_project_id);
CREATE INDEX IF NOT EXISTS idx_cme_scene_graph_nodes_scene_graph_id ON public.cme_scene_graph_nodes(scene_graph_id);

-- RLS
ALTER TABLE public.cme_scene_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cme_scene_graph_nodes ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Users can view their own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users can insert their own scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Admins have full access to scene graphs" ON public.cme_scene_graphs;
DROP POLICY IF EXISTS "Users can update their own scene graphs" ON public.cme_scene_graphs;

CREATE POLICY "Users can view their own scene graphs" ON public.cme_scene_graphs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scene graphs" ON public.cme_scene_graphs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scene graphs" ON public.cme_scene_graphs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins have full access to scene graphs" ON public.cme_scene_graphs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'gpu_operator')
        )
    );

-- Policies for nodes
DROP POLICY IF EXISTS "Users can access their own nodes" ON public.cme_scene_graph_nodes;
CREATE POLICY "Users can access their own nodes" ON public.cme_scene_graph_nodes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.cme_scene_graphs sg 
            WHERE sg.id = scene_graph_id AND sg.user_id = auth.uid()
        )
    );

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
